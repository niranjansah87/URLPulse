import { Suspense } from "react";
import { Bell, Clock, KeyRound, Lock, LockKeyhole, Mail, MailCheck, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { AuthLayout, type AuthBullet } from "./AuthLayout";
import { AuthForm } from "./AuthForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { VerifyEmailResult } from "./VerifyEmailResult";

/**
 * Page compositions for the four auth screens. Copy, bullets, and illustrations
 * follow the references one-to-one; the shared AuthLayout carries the structure.
 */

const PRODUCT_BULLETS: AuthBullet[] = [
  { icon: Zap, tone: "accent", title: "Real-time Monitoring", text: "Get live results as URLs are checked in the background." },
  { icon: ShieldCheck, tone: "success", title: "Reliable & Accurate", text: "Global rate limiting, retries, and smart error handling." },
  { icon: Bell, tone: "warning", title: "Instant Alerts", text: "Get notified when something breaks that matters." },
];

export function LoginScreen() {
  return (
    <AuthLayout
      headline="Monitor URLs."
      headlineAccent="Stay Ahead."
      lede="Real-time URL monitoring and instant alerts so you can fix issues before your users do."
      bullets={PRODUCT_BULLETS}
      illustration={{ light: "/illustration/login-light.png", dark: "/illustration/dashboard-dark.png" }}
      cardTitle="Welcome back"
      cardSubtitle="Login to your URLPulse account"
    >
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthLayout>
  );
}

export function SignupScreen() {
  return (
    <AuthLayout
      headline="Create your"
      headlineAccent="URLPulse account"
      lede="Start monitoring your URLs in seconds. Reliable. Real-time. Effortless."
      bullets={[
        { icon: Zap, tone: "accent", title: "Real-time Monitoring", text: "Get live status updates and instant alerts when URLs fail." },
        { icon: ShieldCheck, tone: "success", title: "Reliable & Accurate", text: "Advanced checks with smart retries to ensure accurate results." },
        { icon: Bell, tone: "warning", title: "Instant Alerts", text: "Stay informed via email whenever something breaks." },
      ]}
      illustration={{ light: "/illustration/signup-light.png", dark: "/illustration/signup-light.png" }}
      cardTitle="Create your account"
      cardSubtitle="Join URLPulse and keep your links healthy."
    >
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthLayout>
  );
}

export function ForgotPasswordScreen() {
  return (
    <AuthLayout
      headline="Forgot your"
      headlineAccent="password?"
      lede="No worries! Enter your registered email and we'll send you a link to reset your password."
      bullets={[
        { icon: Mail, tone: "accent", title: "Secure Reset Link", text: "We'll send a secure link to your registered email address." },
        { icon: ShieldCheck, tone: "success", title: "Safe & Secure", text: "Your account is protected with industry-standard security." },
        { icon: Clock, tone: "warning", title: "Quick & Easy", text: "Reset your password in just a few simple steps." },
      ]}
      illustration={{ light: "/illustration/forgot-password-light.png", dark: "/illustration/forgot-password-dark.png" }}
      cardTitle="Reset your password"
      cardSubtitle="Enter your email address and we'll send you a link to reset your password."
      cardIcon={<Lock size={40} strokeWidth={1.5} />}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export function ResetPasswordScreen() {
  return (
    <AuthLayout
      headline="Reset your"
      headlineAccent="password"
      lede="Enter a new, strong password to secure your account."
      bullets={[
        { icon: ShieldCheck, tone: "accent", title: "Secure Your Account", text: "Choose a strong password to keep your data and URLs safe." },
        { icon: LockKeyhole, tone: "success", title: "Easy & Quick", text: "Reset your password in just a few simple steps." },
        { icon: KeyRound, tone: "warning", title: "Back to Monitoring", text: "Once reset, you can jump right back into monitoring." },
      ]}
      illustration={{ light: "/illustration/reset-password-light.png", dark: "/illustration/reset-password-dark.png" }}
      cardTitle="Create new password"
      cardSubtitle="Your new password must be different from previously used passwords."
      cardIcon={<RefreshCw size={40} strokeWidth={1.5} />}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}

export function VerifyEmailScreen() {
  return (
    <AuthLayout
      headline="Verify your"
      headlineAccent="email"
      lede="Confirm your email address to activate your URLPulse account and unlock full access."
      bullets={[
        { icon: MailCheck, tone: "accent", title: "One quick step", text: "Verifying your email keeps your account secure." },
        { icon: ShieldCheck, tone: "success", title: "Safe & Secure", text: "Your account is protected with industry-standard security." },
        { icon: Bell, tone: "warning", title: "Stay in the loop", text: "Get alerts the moment something breaks that matters." },
      ]}
      illustration={{ light: "/illustration/verify-email-light.png", dark: "/illustration/verify-email-light.png" }}
      cardTitle="Email verification"
      cardSubtitle="We're confirming your email address."
      cardIcon={<MailCheck size={40} strokeWidth={1.5} />}
    >
      <Suspense fallback={null}>
        <VerifyEmailResult />
      </Suspense>
    </AuthLayout>
  );
}
