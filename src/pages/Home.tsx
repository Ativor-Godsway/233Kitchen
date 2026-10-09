import { Hero } from '../components/hero/Hero';
import { MenuSection } from '../components/sections/MenuSection';
import { Pickup } from '../components/sections/Pickup';
import { Faq } from '../components/sections/Faq';
import { KenteBand } from '../components/KenteBand';

export default function Home() {
  return (
    <>
      <Hero />
      <KenteBand animate height={6} />
      <MenuSection />
      <Pickup />
      <Faq />
    </>
  );
}
