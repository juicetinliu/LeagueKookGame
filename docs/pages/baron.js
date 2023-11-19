import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";

export class BaronGamePage extends Page {
    constructor(app) {
        super("baron-game-page", app);

    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="baron-game-page-wrapper">
                BARON
            </div>
        `;
        
        super.create();
        return page;
    }
}