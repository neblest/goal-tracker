import React, { useEffect, useState } from "react";
import { Sparkles, ThumbsUp, PartyPopper, Heart, Star, Smile } from "lucide-react";

interface CongratulationsAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

type IconType = "sparkles" | "thumbsUp" | "partyPopper" | "heart" | "star" | "smile";

interface FloatingIcon {
  id: number;
  type: IconType;
  left: string;
  top: string;
  delay: number;
  size: number;
}

export function CongratulationsAnimation({ isOpen, onClose, userName = "Użytkowniku" }: CongratulationsAnimationProps) {
  const [icons, setIcons] = useState<FloatingIcon[]>([]);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Generate random icons with random types
      const iconTypes: IconType[] = ["sparkles", "thumbsUp", "partyPopper", "heart", "star", "smile"];
      const generatedIcons: FloatingIcon[] = Array.from({ length: 120 }, (_, i) => ({
        id: i,
        type: iconTypes[Math.floor(Math.random() * iconTypes.length)],
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: Math.random() * 1.5,
        size: Math.random() * 16 + 12, // Random size between 12 and 28
      }));
      setIcons(generatedIcons);

      // Show text after a brief delay
      const textTimer = setTimeout(() => setShowText(true), 300);

      return () => clearTimeout(textTimer);
    } else {
      setShowText(false);
      setIcons([]);
    }
  }, [isOpen]);

  const renderIcon = (icon: FloatingIcon) => {
    const iconProps = {
      style: {
        filter: "drop-shadow(0 0 4px rgba(250, 204, 21, 0.8))",
      },
    };

    switch (icon.type) {
      case "sparkles":
        return <Sparkles className="text-yellow-400" {...iconProps} />;
      case "thumbsUp":
        return <ThumbsUp className="text-blue-400" {...iconProps} />;
      case "partyPopper":
        return <PartyPopper className="text-pink-400" {...iconProps} />;
      case "heart":
        return <Heart className="text-red-400" {...iconProps} />;
      case "star":
        return <Star className="text-yellow-300" {...iconProps} />;
      case "smile":
        return <Smile className="text-orange-400" {...iconProps} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      {/* Floating Icons */}
      {icons.map((icon) => (
        <div
          key={icon.id}
          className="absolute animate-star-fade-in"
          style={{
            left: icon.left,
            top: icon.top,
            animationDelay: `${icon.delay}s`,
            width: `${icon.size}px`,
            height: `${icon.size}px`,
          }}
        >
          {renderIcon(icon)}
        </div>
      ))}

      {/* Congratulations Text */}
      <div
        className={`relative z-10 max-w-2xl px-8 text-center transition-all duration-1000 ${
          showText ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg leading-tight">
          Gratulacje, {userName}
          <br />
          <span className="text-[#D4A574]">osiągnięcia kolejnego celu!</span>
        </h1>
      </div>

      <style jsx>{`
        @keyframes icon-float {
          0% {
            opacity: 0;
            transform: scale(0) translateY(0);
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: scale(1.2) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-star-fade-in {
          animation: icon-float 3s ease-in-out infinite;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
