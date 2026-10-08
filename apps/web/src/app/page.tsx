import { ConversationSteps } from "@/components/home/ConversationSteps";
import { Faq } from "@/components/home/Faq";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HomeHero } from "@/components/home/HomeHero";
import { InstallSnippet } from "@/components/home/InstallSnippet";
import { Marquee } from "@/components/home/Marquee";
import { Measured } from "@/components/home/Measured";
import { MessyMoments } from "@/components/home/MessyMoments";
import { Seats } from "@/components/home/Seats";

// The homepage is the demo first (DESIGN_SYSTEM §11, phase 11), then the story of the product. Each section
// takes its character from one reference in docs/design-references (DESIGN_SYSTEM §13); only the demo runs on
// the client.
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">
        <HomeHero />
        <ConversationSteps />
        <Marquee />
        <Seats />
        <MessyMoments />
        <Measured />
        <InstallSnippet />
        <Faq />
      </main>
      <HomeFooter />
    </div>
  );
}
