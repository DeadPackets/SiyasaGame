import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";

export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
gsap.registerPlugin(CustomEase, SplitText);
CustomEase.create("settle", ".45,0,.15,1");
CustomEase.create("swift", ".4,0,.2,1");
CustomEase.create("soft", ".37,0,.63,1");
CustomEase.create("sweep", ".87,0,.13,1");
gsap.defaults({ ease: "settle", overwrite: "auto" });
export { gsap, CustomEase, SplitText };
