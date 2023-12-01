import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GameUtils } from "../game.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";

export class BaronGamePage extends Page {
    constructor(app) {
        super("baron-game-page", app);
        this.pageWrapper = new Element("id", "baron-game-page-wrapper");
        this.loadingContent = new Element("id", "baron-game-page-loading-content");
        this.baronContent = new Element("id", "baron-game-page-baron-content");


        this.baronHealthBarWrapper = new Element("id", "baron-health-bar-wrapper");
        this.baronHealthBar = new Element("id", "baron-health-bar");

        this.baronCodeInput = new Element("id", "baron-code-input");
        this.baronCodeSubmitButton = new Element("id", "baron-code-submit-button");

        this.returnToLobbyButton = new Element("id", "baron-return-to-lobby");

        this.reset();
    }

    reset() {
        this.adminPage = null;

        this.gameCommsBeingProcessedMap = {};

        this.baronHealth = null;
        this.baronMaxHealth = null;

        if(this.participantCommsListener) {
            this.participantCommsListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous participant GameComms listener");
        }
        if(this.gameStateListener) {
            this.gameStateListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous GameState listener");
        }
        this.participantCommsListener = null;
        this.gameStateListener = null;
        super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up Baron game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        if(this.isAdmin) {
            this.adminPage = this.app.pages.adminGame;
            if(!this.adminPage.createCompleted) {
                let adminPage = this.adminPage.create();
                this.app.mainWrapper.getElement().appendChild(adminPage);
            }
            await this.adminPage.setup(setupArgs);
            this.adminPage.hide();
        } else {
            if(!this.roomId || this.winningTeam) {
                this.showEndGameView();
            } else {
                // TODO: Refactor into fire?
                this.participantCommsListener = this.app.fire.attachParticipantGameCommsListener(this.roomId, (comms) => {
                    Object.entries(comms).filter(commInfo => {
                        return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
                    }).forEach(commInfo => {
                        this.proccessGameComms(commInfo[0], commInfo[1]);
                    });
                });
    
                this.gameStateListener = this.app.fire.attachGameStateListener(this.roomId, (gameState) => {
                    this.previousGameState = gameState;
                    if(GameUtils.isGameInProgress(gameState) && this.baronHealth && this.baronMaxHealth) {
                        this.setBaronHealth(this.baronHealth);
                        this.showBaronContent();
                    } else if (GameUtils.hasGameEnded(gameState)) {
                        console.log("=== GAME ENDED ===")
                        this.reset();
                        this.app.savePageStateToHistory(true);
                        this.showEndGameView();
                        //Go back to lobby
                    }
                });
                this.showLoaderContent();
            }
        }
        super.setup();
    }

    async proccessGameComms(gameCommId, gameComm) {
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZE_BARON) {
            this.baronMaxHealth = gameComm.data.health;
            this.setBaronHealth(this.baronMaxHealth);

            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.INITIALIZATION_DONE, {fireUserUid: this.app.fire.fireUser.uid});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);

            this.showBaronView(true);
        } else if(gameComm.commType === GAME_COMM_TYPES.REPORT_BARON_CODE) {
            if(gameComm.data.isValid) {
                if(gameComm.data.isLastHit) {
                    this.winningTeam = gameComm.data.team;
                    this.pageState.winningTeam = this.winningTeam;
                    this.app.savePageStateToHistory(true);

                    this.showEndGameView();
                    return;
                } else {
                    this.showBaronView();
                }

                this.setBaronHealth(gameComm.data.healthAfterDamage, gameComm.data.damageAmount);
                this.showBaronContent();
            } else {
                console.log("Baron code was not valid, please try again");
                this.baronCodeInput.getElement().value = "";
                this.showBaronContent();
            }
        } else {
            console.log(`No Baron action done for comm type ${this.commType}`);
            return;
        }
        this.app.fire.setParticipantGameCommAsProcessed(this.roomId, gameCommId);
    }

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.isAdmin = setupArgs.isAdmin;
        this.lobbyUserList = setupArgs.lobbyUserList;
        this.winningTeam = setupArgs.winningTeam;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isAdmin = this.isAdmin;
        this.pageState.lobbyUserList = this.lobbyUserList;
        this.pageState.winningTeam = this.winningTeam;
    }

    setBaronHealth(health) {
        this.baronHealth = health;
        if(this.baronHealthBar.exists()) {
            this.baronHealthBar.getElement().innerHTML = this.createBaronHealthBarContent(this.baronHealth);
        }
    }

    showBaronView(isBufferedView = false) {
        this.showLoaderContent(true);
        this.baronContent.getElement().innerHTML = this.createBaronContent();
        
        this.baronCodeSubmitButton.addEventListener(["click"], async () => {
            this.showLoaderContent();
            let baronCodeInputValue = this.baronCodeInput.getElement().value;
            //send to admin!
            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.VERIFY_BARON_CODE, {fireUserUid: this.app.fire.fireUser.uid, baronCode: baronCodeInputValue});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
            return;
        });

        // !isBufferedView - we don't want to show the content if we buffer it; THOUGH we must make sure to call showBaronContent again.
        // isGameInProgress - we show the content straight away since the game has already started!!
        if(!isBufferedView || GameUtils.isGameInProgress(this.previousGameState)) this.showBaronContent();
    }

    showEndGameView() {
        this.showLoaderContent(true);
        this.baronContent.getElement().innerHTML = this.createEndGameContent();

        this.returnToLobbyButton.addEventListener(["click"], async () => {
            this.showLoaderContent();

            await this.app.goToPage(this.app.pages.lobby, {
                roomId: this.roomId,
                roomPasscode: this.roomPasscode,
                isAdmin: this.isAdmin,
                isParticipant: true,
                isRoomLocked: false,
                isReady: true,
            });
            return;
        });

        this.showBaronContent();
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="${this.pageWrapper.label}" class="h hv-c vh-c">
                <div id="${this.baronContent.label}" class="v vh-c hv-c hide">
                </div>
                ${this.createLoadingContent()}
            </div>
        `;
        
        super.create();
        return page;
    }

    createBaronHealthBarContent(health) {
        return `${health} HP`;
    }

    createEndGameContent() {
        if(this.winningTeam) {
            return `
                <div class="h hv-c vh-c">
                    Congrats team ${this.winningTeam} on defeating Baron!
                </div>
                <div class="h hv-c vh-c">
                    <button id=${this.returnToLobbyButton.label}>
                        Return to Lobby
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="h hv-c vh-c">
                    Game is closed, return to lobby!
                </div>
                <div class="h hv-c vh-c">
                    <button id=${this.returnToLobbyButton.label}>
                        Return to Lobby
                    </button>
                </div>
            `;
        }
    }

    createBaronContent() {
        return `
            <div class="h hv-c vh-c">
                <img id="baron-game-page-loader" src="assets/baron/baron.png"></img>
            </div>
            <div class="h hv-c vh-c">
                <div id="${this.baronHealthBarWrapper.label}">
                    <div id="${this.baronHealthBar.label}">
                        ${this.createBaronHealthBarContent('anything')}
                    </div>
                </div>
            </div>
            <div class="h hv-c vh-c">
                <div class="panel">
                    <input id="${this.baronCodeInput.label}" placeholder="Enter a Baron Attack Code">
                    <button id="${this.baronCodeSubmitButton.label}">
                        Submit
                    </button>
                </div>
            </div>
        `;
    }

    showBaronContent() {
        this.baronContent.show();
        this.loadingContent.hide();
    }

    showLoaderContent(clearBaronContent = false) {
        if(clearBaronContent) {
            this.baronContent.getElement().innerHTML = "";
        }
        this.baronContent.hide();
        this.loadingContent.show();
    }

    createLoadingContent() {
        return `
            <div id="${this.loadingContent.label}" class="v vh-c hv-c">
                <img id="baron-game-page-loader" src="assets/ornn/ornn.gif"></img>
            </div>
        `;
    }

    show() {
        super.show();
    }
}