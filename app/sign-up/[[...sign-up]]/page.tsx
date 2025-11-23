import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <SignUp 
        routing="path"
        path="/sign-up"
        appearance={{
          elements: {
            headerTitle: {
              // Custom title styling
            },
          },
        }}
      />
    </div>
  );
}

