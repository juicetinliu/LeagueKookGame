import { Component } from "./components.js";

export class Page extends Component {
    constructor(pageId, app) {
        super("id", pageId, null, app);

        this.pageState = {};
        this.isShowing = false;
    }

    reset() {
        this.pageState = {};
    }

    hide() {
        this.isShowing = false;
        super.hide();
    }

    show(savePageState = true) {
        //common page functions
        this.isShowing = true;
        if(savePageState) this.app.savePageStateToHistory(true);
        super.show();
    }

    create() {
        //common page functions
        super.create();
    }

    setup() {
        //common page functions
        super.setup();
    }

    unloadToState() {
        return this.pageState;
    }
}