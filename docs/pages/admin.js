import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";

export class AdminGamePage extends Page {
    constructor(app) {
        super("admin-game-page", app);

    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="admin-game-page-wrapper">
                ADMIN
            </div>
        `;
        
        super.create();
        return page;
    }
}