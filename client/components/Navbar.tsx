import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 container mx-auto justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-lg">
            Path.ai
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ModeToggle />
          
          <SignedOut>
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">
                  Sign Up
                </Button>
              </SignUpButton>
            </div>
          </SignedOut>
          
          <SignedIn>
            <UserButton 
              afterSignOutUrl="/"
            />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
