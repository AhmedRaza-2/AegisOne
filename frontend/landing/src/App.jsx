import HeroSection from "./components/HeroSection"
import SectionBrands from "./components/SectionBrands"
import SectionAbout from "./components/SectionAbout"
import SectionProcess from "./components/SectionProcess"
import SectionServices from "./components/SectionServices"
import SectionTechStack from "./components/SectionTechStack"
import SiteFooter from "./components/SiteFooter"
import SiteHeader from "./components/SiteHeader"
import SectionContact from "./components/SectionContact"

const App = () => {
  return (
    <>
      <SiteHeader />
      <HeroSection />
      <SectionServices />
      <SectionProcess />
      <SectionTechStack />
      <SectionAbout />
      <SectionBrands />
      <SectionContact />
      <SiteFooter />
    </>
  )
}

export default App