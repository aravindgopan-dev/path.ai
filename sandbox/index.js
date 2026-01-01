const { Server } = require("socket.io");
const { createServer } = require("http");
const { exec } = require("child_process");

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

// Handle client connections
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle command execution requests
    socket.on("execute-command", (command) => {
        console.log(`Executing command: ${command}`);

        // Execute the command
        const childProcess = exec(command, {
            cwd: __dirname, // Execute in the sandbox directory
            env: process.env
        });

        // Stream stdout to client
        childProcess.stdout.on("data", (data) => {
            // Convert \n to \r\n for proper terminal display
            const output = data.toString().replace(/\n/g, '\r\n');
            socket.emit("command-output", {
                type: "stdout",
                data: output
            });
        });

        // Stream stderr to client
        childProcess.stderr.on("data", (data) => {
            // Convert \n to \r\n for proper terminal display
            const output = data.toString().replace(/\n/g, '\r\n');
            socket.emit("command-output", {
                type: "stderr",
                data: output
            });
        });

        // Handle command completion
        childProcess.on("close", (code) => {
            socket.emit("command-complete", {
                code,
                message: `Command exited with code ${code}`
            });
            console.log(`Command completed with code: ${code}`);
        });

        // Handle errors
        childProcess.on("error", (error) => {
            socket.emit("command-error", {
                error: error.message
            });
            console.error(`Command error: ${error.message}`);
        });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Start the server
const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on http://localhost:${PORT}`);
});