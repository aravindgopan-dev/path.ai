const { Server } = require("socket.io");
const { createServer } = require("http");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server with CORS configuration
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000", // Next.js frontend
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Store shell sessions per socket
const shellSessions = new Map();

// Helper function to recursively create directory structure
async function createDirectoryStructure(basePath, nodes) {
    for (const node of nodes) {
        const nodePath = path.join(basePath, node.name);

        if (node.type === 'directory') {
            // Create directory
            await fs.mkdir(nodePath, { recursive: true });
            console.log(`Created directory: ${nodePath}`);

            // Recursively create children
            if (node.children && node.children.length > 0) {
                await createDirectoryStructure(nodePath, node.children);
            }
        } else if (node.type === 'file') {
            // Create file with initial content
            const initialContent = `// ${node.name}\n// ${node.description || 'No description'}\n\n// Start coding here...\n`;
            await fs.writeFile(nodePath, initialContent, 'utf8');
            console.log(`Created file: ${nodePath}`);
        }
    }
}

// Handle client connections
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create a persistent shell session for this client
    const shell = spawn('/bin/bash', [], {
        cwd: __dirname,
        env: process.env,
    });

    // Store the shell session
    shellSessions.set(socket.id, shell);

    // Stream stdout to client
    shell.stdout.on("data", (data) => {
        const output = data.toString().replace(/\n/g, '\r\n');
        socket.emit("command-output", {
            type: "stdout",
            data: output
        });
    });

    // Stream stderr to client
    shell.stderr.on("data", (data) => {
        const output = data.toString().replace(/\n/g, '\r\n');
        socket.emit("command-output", {
            type: "stderr",
            data: output
        });
    });

    // Handle shell exit
    shell.on("close", (code) => {
        console.log(`Shell session closed for ${socket.id} with code: ${code}`);
        shellSessions.delete(socket.id);
    });

    // Handle shell errors
    shell.on("error", (error) => {
        socket.emit("command-error", {
            error: error.message
        });
        console.error(`Shell error for ${socket.id}: ${error.message}`);
    });

    // Handle project creation
    socket.on("create-project", async (projectSpec) => {
        try {
            const projectName = projectSpec.projectName.toLowerCase().replace(/\s+/g, '-');
            const projectPath = path.join(__dirname, 'projects', projectName);

            // Check if project already exists
            try {
                await fs.access(projectPath);
                console.log(`Project already exists: ${projectName}`);
                socket.emit("project-created", {
                    success: true,
                    message: "Project already exists",
                    path: projectPath,
                    alreadyExists: true
                });
                return;
            } catch (err) {
                // Project doesn't exist, continue with creation
            }

            // Create projects directory if it doesn't exist
            await fs.mkdir(path.join(__dirname, 'projects'), { recursive: true });

            // Create project directory
            await fs.mkdir(projectPath, { recursive: true });

            // Create the file structure
            if (projectSpec.designerInput && projectSpec.designerInput.nodes) {
                await createDirectoryStructure(projectPath, projectSpec.designerInput.nodes);
            }

            // Create a README.md with project info
            const readmeContent = `# ${projectSpec.projectName}\n\n${projectSpec.description}\n\n## Features\n\n${projectSpec.features.map(f => `- **${f.name}**: ${f.description}`).join('\n')}\n`;
            await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

            console.log(`Project created successfully: ${projectName}`);
            socket.emit("project-created", {
                success: true,
                message: "Project created successfully",
                path: projectPath,
                alreadyExists: false
            });
        } catch (error) {
            console.error(`Error creating project: ${error.message}`);
            socket.emit("project-created", {
                success: false,
                error: error.message
            });
        }
    });

    // Handle file write requests
    socket.on("write-file", async ({ projectName, filePath, content }) => {
        try {
            const sanitizedProjectName = projectName.toLowerCase().replace(/\s+/g, '-');
            const fullPath = path.join(__dirname, 'projects', sanitizedProjectName, filePath);

            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true });

            // Write file
            await fs.writeFile(fullPath, content, 'utf8');
            console.log(`File written: ${fullPath}`);

            socket.emit("file-written", {
                success: true,
                path: filePath
            });
        } catch (error) {
            console.error(`Error writing file: ${error.message}`);
            socket.emit("file-written", {
                success: false,
                error: error.message
            });
        }
    });

    // Handle file read requests
    socket.on("read-file", async ({ projectName, filePath }) => {
        try {
            const sanitizedProjectName = projectName.toLowerCase().replace(/\s+/g, '-');
            const fullPath = path.join(__dirname, 'projects', sanitizedProjectName, filePath);

            const content = await fs.readFile(fullPath, 'utf8');

            socket.emit("file-content", {
                success: true,
                path: filePath,
                content
            });
        } catch (error) {
            console.error(`Error reading file: ${error.message}`);
            socket.emit("file-content", {
                success: false,
                error: error.message
            });
        }
    });

    // Handle command execution requests (now using persistent shell)
    socket.on("execute-command", (command) => {
        console.log(`Executing command: ${command}`);

        const shell = shellSessions.get(socket.id);
        if (!shell) {
            socket.emit("command-error", {
                error: "Shell session not found"
            });
            return;
        }

        // Write command to shell stdin
        shell.stdin.write(command + '\n');
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);

        // Clean up shell session
        const shell = shellSessions.get(socket.id);
        if (shell) {
            shell.kill();
            shellSessions.delete(socket.id);
        }
    });
});

// Start the server
const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on http://localhost:${PORT}`);
});