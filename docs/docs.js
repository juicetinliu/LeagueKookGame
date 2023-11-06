import { DesktopAppWIP, MobileAppNA, App } from "./app.js";

let isMobile = window.innerWidth < 500 || is_mobile_or_tablet_view();
let a = isMobile ? new MobileAppNA(): new App();
a.start();