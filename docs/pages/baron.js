import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";

export class BaronGamePage extends Page {
    constructor(app) {
        super("baron-game-page", app);

        this.reset();
    }

    reset() {
        this.isAdmin = false;
        this.adminPage = null;
        super.reset();
    }

    setup(setupArgs) {
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        if(this.isAdmin) {
            this.adminPage = this.app.pages.adminGame;
            if(!this.adminPage.createCompleted) {
                let adminPage = this.adminPage.create();
                this.app.mainWrapper.getElement().appendChild(adminPage);
            }
            this.adminPage.setup({});
            this.adminPage.hide();
        }
        super.setup();
    }

    setRoomParametersAndPageState(setupArgs) {
        this.isAdmin = setupArgs.isAdmin;

        this.pageState.isAdmin = this.isAdmin;
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