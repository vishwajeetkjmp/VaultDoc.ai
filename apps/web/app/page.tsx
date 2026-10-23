import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import SiteFooter from "../components/SiteFooter";
import AccountDeletedNotice from "../components/AccountDeletedNotice";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <SiteFooter />
      <AccountDeletedNotice />
    </main>
  );
}
