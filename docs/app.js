import { documentCreateElement, Element } from "./components.js";


export class App {
    constructor() {
        this.main = new Element("id", "main");

        this.pages = {};

        this.APP_CONSTANTS = {
        }

    }

    start() {
        this.setup();
        this.main.show();
    }

    setup(){
        console.log("not implemented");
    }

    exit(){
    }
}

class InitialApp extends App {
    constructor() {
        super();
        this.CONSTANTS = {
        }
    }

    start() {
        super.start();
    }

    setup(){

    }

    exit(){
    }
}

class AdminApp extends App {
    // Acts as the server
    // Creates and "runs" Game objects
    //

}

class ParticipantApp extends App {

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

        let message = documentCreateElement("div", "header-text", "unsupported-message");
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

        let message = documentCreateElement("div", "header-text", "unsupported-message");
        message.innerHTML = "Work in progress 🛠️"
        messageBlock.appendChild(message);

        let message2 = documentCreateElement("div", "message-text", "unsupported-message");
        message2.innerHTML =  "Go play league instead! 😗"
        messageBlock.appendChild(message2);

        this.main.getElement().appendChild(messageBlock);
        this.main.getElement().classList.add("desktop-app-unsupported");
    }
}