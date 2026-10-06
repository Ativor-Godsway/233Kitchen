import { Hero } from '../components/hero/Hero';
import { HowItWorks } from '../components/sections/HowItWorks';
import { MenuSection } from '../components/sections/MenuSection';
import { Gallery } from '../components/sections/Gallery';
import { Pickup } from '../components/sections/Pickup';
import { Faq } from '../components/sections/Faq';
import { KenteBand } from '../components/KenteBand';

export default function Home() {
  return (
    <>
      <Hero />
      <KenteBand animate height={6} />
      <HowItWorks />
      <MenuSection />
      <Gallery />
      <Pickup />
      <Faq />
    </>
  );
}
