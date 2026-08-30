import { useEffect } from "react";
import { Navbar } from "../components/landing/Navbar";
import { Hero } from "../components/landing/Hero";
import { ProblemSection } from "../components/landing/ProblemSection";
import { ProductLifecycle } from "../components/landing/ProductLifecycle";
import { FeaturesGrid } from "../components/landing/FeaturesGrid";
import { LogicShowcase } from "../components/landing/LogicShowcase";
import { ValidationShowcase } from "../components/landing/ValidationShowcase";
import { WorkflowCards } from "../components/landing/WorkflowCards";
import { Process } from "../components/landing/Process";
import { ProductStory } from "../components/landing/ProductStory";
import { FinalCTA } from "../components/landing/FinalCTA";
import { ScrollGradientBackground } from "../components/landing/ScrollGradientBackground";

export default function LandingPage() {
  useEffect(() => {
    document.title = "FormCraft — Build Forms Without the Busywork";
  }, []);

  return (
    <div className="relative min-h-screen scroll-smooth bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <ScrollGradientBackground />
      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <ProblemSection />
          <ProductLifecycle />
          <FeaturesGrid />
          <LogicShowcase />
          <ValidationShowcase />
          <WorkflowCards />
          <Process />
          <ProductStory />
          <FinalCTA />
        </main>
      </div>
    </div>
  );
}
