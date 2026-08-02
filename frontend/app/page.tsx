import { BackgroundEffects } from "@/components/BackgroundEffects";
import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { InteractiveDemo } from "@/components/InteractiveDemo";
import { Navbar } from "@/components/Navbar";
import { ProductStory } from "@/components/ProductStory";
import { ResultsSection } from "@/components/ResultsSection";

export default function Home() {
  return (
    <main className="marketing-page v3-page">
      <BackgroundEffects />
      <Navbar />
      <Hero />
      <div className="v3-marquee" aria-hidden="true">
        <div>
          Capture <i /> Qualify <i /> Route <i /> Convert <i /> Remember <i />
          Capture <i /> Qualify <i /> Route <i /> Convert
        </div>
      </div>
      <ProductStory />
      <InteractiveDemo />
      <ResultsSection />
      <Footer />
      <ChatWidget />
    </main>
  );
}
