import { documentCreateElement, Element } from "../components.js";
import { Page } from "../page.js";

export class IndexPage extends Page {
    constructor(app) {
        super("index-page", app);

        this.joinRoomButton = new Element("id", "index-join-room-button");
        this.createRoomButton = new Element("id", "index-create-room-button");
    }

    setup() {
        if(!this.setupCompleted){
            this.joinRoomButton.addEventListener(["click"], async () => {
                await this.app.goToPage(this.app.pages.joinRoom, {resetView: true});
            });
            this.createRoomButton.addEventListener(["click"], async () => {
                let roomDetails = await this.app.fire.createRoom();
                console.log("=== GOING TO NEW LOBBY ===");
                await this.app.goToPage(this.app.pages.lobby, roomDetails);
            });
        }
        // Autojoin a room with #<roomId> in url
        // if(window.location.hash) {
        //     this.app.goToPage(this.app.pages.joinRoom, {resetView: true, joinRoomId: window.location.hash.replace('#','')})
        // }
        super.setup();
    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="index-content-row" class="h hv-c vh-c">
                <button id="${this.joinRoomButton.label}" class="index-main-button">
                    Join Room
                </button>
                <button id="${this.createRoomButton.label}" class="index-main-button">
                    Create Room
                </button>
            </div>
        `;
        
        super.create();
        return page;
    }
}

export class JoinRoomPage extends Page {
    constructor(app) {
        super("join-room-page", app);

        this.roomCodeInput = new Element("id", "join-room-room-code-input");
        this.roomCodeSubmitButton = new Element("id", "join-room-room-code-submit-button");
        this.roomCodeContentRow = new Element("id", "join-room-room-content-row");

        this.passCodeInput = new Element("id", "join-room-pass-code-input");
        this.passCodeSubmitButton = new Element("id", "join-room-pass-code-submit-button");
        this.passCodeContentRow = new Element("id", "join-room-pass-content-row");

        this.roomId = null;
        this.roomPasscode = null
    }

    setup(args) {
        if(args && args.resetView) { 
            this.roomCodeInput.getElement().value = "";
            this.passCodeInput.getElement().value = "";
            this.pageState.roomCodeInput = this.roomCodeInput.getElement().value;
            this.app.savePageStateToHistory(true);
        }
        if(!this.setupCompleted){
            this.roomCodeInput.addEventListener(["input"], () => {
                if(this.isShowing) {
                    this.pageState.roomCodeInput = this.roomCodeInput.getElement().value;
                    this.app.savePageStateToHistory(true);
                }
            });
            this.roomCodeSubmitButton.addEventListener(["click"], async () => {
                this.roomId = this.roomCodeInput.getElement().value;
                let roomId = this.roomId;

                let isRoomActive = await this.app.fire.getIsRoomActive(roomId);
                if(isRoomActive) {
                    // window.location.hash = roomId;
                    if(isRoomActive.isAdmin || isRoomActive.isParticipant) {
                        let roomState = await this.app.fire.getRoomState(roomId);

                        if(roomState) {
                            console.log("=== GOING TO EXISTING LOBBY ===");
                            await this.app.goToPage(this.app.pages.lobby, {
                                roomId: roomId,
                                roomPasscode: roomState ? roomState.passcode : roomPass,
                                isAdmin: isRoomActive.isAdmin,
                                isParticipant: isRoomActive.isParticipant,
                                isRoomLocked: roomState ? roomState.isRoomLocked : false,
                                isReady: isRoomActive.isReady ? isRoomActive.isReady : false,
                                gameState: roomState.gameState
                            });
                            return;
                        }
                    }
                    this.passCodeContentRow.show();
                } else {
                    console.log(`Room ${roomId} is not active`);
                    this.passCodeContentRow.hide();
                }
            });

            this.passCodeSubmitButton.addEventListener(["click"], async () => {
                this.roomPasscode = this.passCodeInput.getElement().value;
                let roomPass = this.roomPasscode;
                let roomId = this.roomId;
                let joinSucceded = await this.app.fire.joinWaitList(roomId, roomPass);
                
                if(joinSucceded) {
                    let roomState;
                    if(joinSucceded.isAdmin || joinSucceded.isParticipant) {
                        roomState = await this.app.fire.getRoomState(roomId);
                    }
                    console.log("=== GOING TO EXISTING LOBBY ===");
                    await this.app.goToPage(this.app.pages.lobby, {
                        roomId: roomId,
                        roomPasscode: roomState ? roomState.passcode : roomPass,
                        isAdmin: joinSucceded.isAdmin,
                        isParticipant: joinSucceded.isParticipant,
                        isRoomLocked: roomState ? roomState.isRoomLocked : false,
                        isReady: joinSucceded.isReady ? joinSucceded.isReady : false,
                        gameState: roomState ? roomState.gameState : (joinSucceded.gameState ? joinSucceded.gameState : null)
                    });
                    return;
                } else {
                    console.log(`Failed to join room ${roomId}. Verify password or whether room is locked or active.`)
                    this.passCodeContentRow.hide();
                }
            })
        }
        this.passCodeContentRow.hide();
        // if(args && args.joinRoomId) {
        //     this.roomCodeInput.getElement().value = args.joinRoomId;
        // }
        super.setup();
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="join-room-input-panel" class="v vh-c hv-c panel">
                <div id="${this.roomCodeContentRow.label}" class="h hv-l vh-c">
                    <input id="${this.roomCodeInput.label}" placeholder="Enter Room ID">
                    <button id="${this.roomCodeSubmitButton.label}">
                        Join Room
                    </button>
                </div>
                <div id="${this.passCodeContentRow.label}" class="h hv-l vh-c">
                    <input id="${this.passCodeInput.label}" placeholder="Enter Room Passcode">
                    <button id="${this.passCodeSubmitButton.label}">
                        Submit Passcode
                    </button>
                </div>
            </div>
        `;
        
        super.create();
        return page;
    }

    show(args) {
        super.show();
    }
}