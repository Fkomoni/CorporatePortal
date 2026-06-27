import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";

import TextShowcase from "@/components/ui/text-showcase";
import BackgroundCircle from "@/components/ui/background-circle";
import { LandingArrowIcon, LandingPersonIcon } from "@/components/icons";

const portals = [
  {
    title: "Leadway Health",
    path: "/login",
  },
];

export default function IndexPage() {
  const navigate = useNavigate();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Decorative background elements */}
      <BackgroundCircle />

      <div className="relative z-10 w-full max-w-md px-6 sm:px-0">
        {/* Logo and Header */}
        <div className="animate-fade-in">
          <TextShowcase showDescription={false} />
          <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-[#F15A24] to-[#c61531]" />
          <p className="mt-6 text-center text-base font-medium text-gray-600">
            Click below to access your account
          </p>
        </div>

        {/* Portal Cards */}
        <div className="mt-10 space-y-5">
          {portals.map((portal, index) => (
            <div
              key={index}
              className="animate-slide-up transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Button
                className="h-auto w-full justify-start rounded-2xl border-2 border-gray-200 bg-white p-6 transition-all duration-300 hover:border-[#F15A24] hover:-translate-y-1 hover:bg-gradient-to-r hover:from-white hover:to-orange-50"
                onPress={() => navigate(portal.path)}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Icon indicator */}
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
                        hoveredIndex === index
                          ? "border-[#F15A24] bg-[#F15A24]"
                          : "border-gray-300 bg-gray-100"
                      }`}
                    >
                      <LandingPersonIcon
                        hoveredIndex={hoveredIndex}
                        index={index}
                      />
                    </div>

                    <span className="text-lg font-semibold text-gray-800">
                      {portal.title}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                      hoveredIndex === index
                        ? "bg-[#F15A24] translate-x-1"
                        : "bg-gray-100"
                    }`}
                  >
                    <LandingArrowIcon
                      hoveredIndex={hoveredIndex}
                      index={index}
                    />
                  </div>
                </div>
              </Button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="mt-10 animate-fade-in text-center"
          style={{ animationDelay: "0.3s" }}
        >
          <p className="text-sm font-medium text-gray-500">
            Secure access to your Leadway Health portal
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#F15A24]" />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-[#c61531]"
              style={{ animationDelay: "0.15s" }}
            />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-[#F15A24]"
              style={{ animationDelay: "0.3s" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
