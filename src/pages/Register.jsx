import React, { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { nomeCoachEmUso } from "@/lib/coach";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nomeCoach, setNomeCoach] = useState("");
  const [aceites, setAceites] = useState({ privacidade: false, termos: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // O cadastro exige a leitura e o aceite da Política de Privacidade e dos Termos de Uso
  const aceiteObrigatorio = () => {
    if (aceites.privacidade && aceites.termos) return true;
    setError("Para continuar, leia e aceite a Política de Privacidade e os Termos de Uso.");
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!nomeCoach.trim()) {
      setError("Informe seu nome de Coach");
      return;
    }
    if (!aceiteObrigatorio()) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      if (await nomeCoachEmUso(nomeCoach.trim())) {
        setError("Este nome de Coach já está em uso. Escolha um nome diferente.");
        return;
      }

      const result = await db.auth.register({
        email,
        password,
        coachNome: nomeCoach.trim(),
      });

      // If "Confirm email" is disabled in Supabase, signUp already returns a
      // session. Otherwise the existing six-digit OTP screen is used.
      if (result?.session) {
        await db.auth.updateMe({ coach_nome: nomeCoach.trim() }).catch(() => {});
        window.location.href = safeReturnTo();
        return;
      }

      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await db.auth.verifyOtp({ email, otpCode });
      // Nome de Coach informado no cadastro identifica clientes e avaliações do profissional
      await db.auth.updateMe({ coach_nome: nomeCoach.trim() }).catch(() => {});
      // E-mail confirmado: entra direto no app (a agenda Google é compartilhada)
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await db.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = async () => {
    if (!aceiteObrigatorio()) return;
    setError("");
    try {
      await db.auth.loginWithProvider("google", safeReturnTo());
    } catch (err) {
      setError(err.message || "Could not start Google login");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nomeCoach">Nome do Coach</Label>
          <Input
            id="nomeCoach"
            value={nomeCoach}
            onChange={(e) => setNomeCoach(e.target.value)}
            placeholder="Ex: Coach Ana"
            className="h-12"
            required
          />
          <p className="text-xs text-muted-foreground">
            Identifica seus clientes e avaliações no app. Pode ser alterado depois em Configurações.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={aceites.privacidade}
              onCheckedChange={(v) => setAceites((a) => ({ ...a, privacidade: !!v }))}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Li e aceito a{" "}
              <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                Política de Privacidade
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={aceites.termos}
              onCheckedChange={(v) => setAceites((a) => ({ ...a, termos: !!v }))}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                Termos de Uso
              </Link>
            </span>
          </label>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}