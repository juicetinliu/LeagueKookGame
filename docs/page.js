import { Component } from "./components.js";

export class Page extends Component {
    constructor(pageId, app) {
        super("id", pageId, null, app);

        this.pageState = {};
        this.isShowing = false;
    }

    hide() {
        this.isShowing = false;
        super.hide();
    }

    show() {
        //common page functions
        this.isShowing = true;
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

    loadFromState(state) {
        console.log(state);
    }

    unloadToState() {
        return this.pageState;
    }
}