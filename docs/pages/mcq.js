import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";

export class MCQGamePage extends Page {
    constructor(app) {
        super("mcq-game-page", app);

    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="mcq-game-page-wrapper">
                MCQ
            </div>
        `;
        
        super.create();
        return page;
    }
}