import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { useChunk } from "stunk/react";

import { ErrorText } from "@/components/ui/error-text";
import {
  ArrowLeftIcon,
  EyeFilledIcon,
  EyeSlashFilledIcon,
  LoginArrowRightIcon,
} from "@/components/icons";
import { loginLeadway } from "@/lib/services/auth-service";
import { BaseForm } from "@/types";
import { authStore } from "@/lib/store/auth";
import { backdoorUser } from "@/lib/constants";
import TextShowcase from "@/components/ui/text-showcase";
import AnimatedBG from "@/components/ui/animated-bg";

export default function LeadwayLoginPage() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [, setAuthState] = useChunk(authStore);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const [formData, setFormData] = useState<BaseForm>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const isFormValid =
    formData.email.trim() !== "" && formData.password.trim() !== "";
  const isEmailInvalid =
    formData.email.trim() !== "" && !/\S+@\S+\.\S+/.test(formData.email);

  const handleLogin = async () => {
    if (!isFormValid) return;

    // Backdoor login check
    if (
      formData.email === "NobleZeez@admin.com" &&
      formData.password === "Password@!23"
    ) {
      setAuthState((prev) => ({
        ...prev,
        user: backdoorUser,
      }));
      setApiError("");
      navigate("/dashboard");

      return;
    }

    setIsLoading(true);
    setApiError("");

    try {
      const response = await loginLeadway(formData);

      if (
        response.status === 200 &&
        response.result &&
        response.result.length > 0
      ) {
        const user = response.result[0];

        setAuthState((prev) => ({
          ...prev,
          user: user,
          isLeadway: true,
        }));

        setApiError("");

        navigate("/dashboard");
      } else {
        const errorMsg =
          response.status !== 200
            ? response.ErrorMessage || "An error occurred during login"
            : "No user data received";

        setApiError(errorMsg);
      }
    } catch (error) {
      setApiError(
        `${(error as Error).message || "An unexpected error occurred"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <AnimatedBG />

      <div className="relative z-10 w-full max-w-md px-6 sm:px-0">
        {/* Login Card */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-gray-200 bg-white p-6 backdrop-blur-sm animate-slide-up">
          {/* Header */}
          <div className="mb-8">
            <TextShowcase showDescription={false} />
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-300" />
              <p className="text-center text-sm font-semibold text-gray-600">
                Leadway Health Portal
              </p>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-300" />
            </div>
          </div>

          {/* Error Alert */}
          {apiError && <ErrorText text={apiError} />}

          {/* Login Form */}
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            {/* Email Input */}
            <div className="group relative">
              <Input
                classNames={{
                  label: "text-gray-700 font-medium",
                  input: "text-base",
                }}
                errorMessage={
                  isEmailInvalid ? "Please enter a valid email address" : ""
                }
                isDisabled={isLoading}
                isInvalid={isEmailInvalid}
                label="Email Address"
                placeholder="user@leadway.com"
                radius="lg"
                size="lg"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            {/* Password Input */}
            <div className="group relative">
              <Input
                classNames={{
                  label: "text-gray-700 font-medium",
                  input: "text-base",
                }}
                endContent={
                  <button
                    aria-label="toggle password visibility"
                    className="focus:outline-none transition-transform duration-200 hover:scale-110 active:scale-95"
                    type="button"
                    onClick={toggleVisibility}
                  >
                    {isVisible ? (
                      <EyeSlashFilledIcon className="text-2xl text-gray-400 pointer-events-none" />
                    ) : (
                      <EyeFilledIcon className="text-2xl text-gray-400 pointer-events-none" />
                    )}
                  </button>
                }
                isDisabled={isLoading}
                label="Password"
                placeholder="Enter your password"
                radius="lg"
                size="lg"
                type={isVisible ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            {/* Login Button */}
            <div className="pt-2">
              <Button
                fullWidth
                className="relative overflow-hidden bg-gradient-to-r from-[#F15A24] to-[#c61531] font-bold text-base text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                endContent={<LoginArrowRightIcon />}
                isDisabled={!isFormValid || isLoading}
                isLoading={isLoading}
                radius="lg"
                size="lg"
                type="submit"
              >
                {isLoading ? "Logging in..." : <>Log In</>}
              </Button>
            </div>

            {/* Back Button */}
            <Button
              fullWidth
              className="font-semibold text-base text-gray-700 bg-gray-100 border-2 border-gray-200 hover:bg-gray-200 hover:border-gray-300 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              radius="lg"
              size="lg"
              startContent={<ArrowLeftIcon />}
              variant="flat"
              onPress={() => navigate("/")}
            >
              Go Back
            </Button>
          </form>
        </div>

        {/* Bottom decorative text */}
        <p
          className="mt-6 text-center text-xs text-gray-500 animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          © 2025 Leadway Health. All rights reserved.
        </p>
      </div>
    </div>
  );
}
