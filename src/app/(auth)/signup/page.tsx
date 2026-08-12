import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-heading">Create your account</CardTitle>
        <CardDescription>
          Sign up with your email to create and answer polls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
