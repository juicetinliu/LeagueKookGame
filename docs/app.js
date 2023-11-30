import { documentCreateElement, Element } from "./components.js";
import { Fire } from "./fire.js";
import { AdminGamePage } from "./pages/admin.js";
import { BaronGamePage } from "./pages/baron.js";
import { IndexPage, JoinRoomPage } from "./pages/index.js";
import { LobbyPage } from "./pages/lobby.js";
import { MCQGamePage } from "./pages/mcq.js";

export class App {
    constructor() {
        this.main = new Element("id", "main");
        this.mainWrapper = new Element("id", "main-wrapper");
        this.userType = null;

        this.fire = new Fire();

        this.pages = {
            index: new IndexPage(this),
            joinRoom: new JoinRoomPage(this),
            lobby: new LobbyPage(this),
            adminGame: new AdminGamePage(this),
            baronGame: new BaronGamePage(this),
            mcqGame: new MCQGamePage(this),
        };

        this.currentPage = null;

        this.APP_CONSTANTS = {
        }

        window.onpopstate = (event) => {
            this._loadPageFromHistory(event);
        }
    }

    async start() {
        await this.fire.createAnonymousUser();
        await this.goToPage(this.pages.index, {}, {}, false);
        this.savePageStateToHistory(true);
    }

    async goToPage(page, setupArgs = {}, showArgs = {}, saveToHistory = true) {
        this.main.hide();

        Object.values(this.pages).forEach(page => {
            if(page.createCompleted) page.hide();
        });
        this.currentPage = page;
        if(saveToHistory) this.savePageStateToHistory();
        await this._renderCurrentPage(setupArgs, showArgs);
    }


    async _renderCurrentPage(setupPageArgs = {}, showPageArgs = {}) {
        await this._setupCurrentPage(setupPageArgs);
        this._showCurrentPage(showPageArgs);
    }

    async _setupCurrentPage(pageArgs = {}) {
        if(!this.currentPage.createCompleted) {
            let currentPage = this.currentPage.create();
            this.mainWrapper.getElement().appendChild(currentPage);
        }
        await this.currentPage.setup(pageArgs);
    }

    _showCurrentPage(pageArgs = {}) {
        this.currentPage.show(pageArgs);
        this.main.show();
    }

    savePageStateToHistory(replace = false) {
        let currentPage = this.currentPage;
        let currentPageId = Object.keys(this.pages).find(key => this.pages[key] === currentPage);
        let pageState = currentPage.unloadToState();
        let stateObject = {
            currentPageId: currentPageId,
            pageState: pageState
        };
        if (replace) {
            history.replaceState(stateObject, "");
        } else {
            history.pushState(stateObject, "");
        }
    }

    async _loadPageFromHistory(event) {
        let state = event.state;
        if(state) {
            let currentPageId = state.currentPageId;
            let pageState = (state.pageState && Object.keys(state.pageState).length) ? state.pageState : {} ;
            await this.goToPage(this.pages[currentPageId], pageState, {}, false);
        }
    }

    exit(){
    }
}

export class MobileAppNA {
    constructor() {        
        this.main = new Element("id", "main");
        this.mainWrapper = new Element("id", "main-wrapper");
    }

    start() {
        this.setup();
        this.main.show();
    }

    setup() {
        this.mainWrapper.delete();
        let messageBlock = documentCreateElement("div", "main-content", "v vh-c hv-c".split(" "));

        let baronImg = documentCreateElement("img", "baron-nashor");
        baronImg.src = "assets/baron/baron.png"
        messageBlock.appendChild(baronImg);

        let message = documentCreateElement("div", "image-text", "unsupported-message");
        message.innerHTML = "Like league, this game doesn't run on mobile 😉"
        messageBlock.appendChild(message);

        let message2 = documentCreateElement("div", "message-text", "unsupported-message");
        message2.innerHTML =  "Try it on Desktop! 🖥️"
        messageBlock.appendChild(message2);

        this.main.getElement().appendChild(messageBlock);
        this.main.getElement().classList.add("mobile-app-unsupported");
    }
}

export class DesktopAppWIP {
    constructor() {        
        this.main = new Element("id", "main");
        this.mainWrapper = new Element("id", "main-wrapper");
    }

    start() {
        this.setup();
        this.main.show();
    }

    setup() {
        this.mainWrapper.delete();
        let messageBlock = documentCreateElement("div", "main-content", "v vh-c hv-c".split(" "));

        let baronImg = documentCreateElement("img", "ornn-wip");
        baronImg.src = "assets/ornn/ornn.gif"
        messageBlock.appendChild(baronImg);

        let message = documentCreateElement("div", "image-text", "unsupported-message");
        message.innerHTML = "Work in progress 🛠️"
        messageBlock.appendChild(message);

        let message2 = documentCreateElement("div", "message-text", "unsupported-message");
        message2.innerHTML =  "Go play league instead! 😗"
        messageBlock.appendChild(message2);

        this.main.getElement().appendChild(messageBlock);
        this.main.getElement().classList.add("desktop-app-unsupported");
    }
}