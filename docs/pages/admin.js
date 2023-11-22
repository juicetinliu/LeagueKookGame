import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";
import { LeagueKookGame } from "../game.js";

export class AdminGamePage extends Page {
    constructor(app) {
        super("admin-game-page", app);
        
        this.reset();
    }

    reset() {
        this.game = null;
        super.reset();
    }

    setup(setupArgs) {
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        this.game = new LeagueKookGame(this.app);
        this.game.initialize(setupArgs);

        super.setup();
    }

    setRoomParametersAndPageState(setupArgs) {
        this.lobbyUserList = setupArgs.lobbyUserList;

        this.pageState.lobbyUserList = this.lobbyUserList;
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

    hide() {
        super.hide();
    }

    show() {
        this.app.savePageStateToHistory(true);
        super.show();
    }
}