import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_ROLES, GameUtils } from "../game.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";
import { ONE_SECOND } from "../util.js";

export class BaronGamePage extends Page {
    constructor(app) {
        super("baron-game-page", app);
        this.pageWrapper = new Element("id", "baron-game-page-wrapper");
        this.loadingContent = new Element("id", "baron-game-page-loading-content");
        this.baronContent = new Element("id", "baron-game-page-baron-content");


        this.baronHealthBarWrapper = new Element("id", "baron-health-bar-wrapper");
        this.baronHealthBarText = new Element("id", "baron-health-bar-text");
        this.baronHealthBar = new Element("id", "baron-health-bar");
        this.baronHealthBarRemainingHealth = new Element("id", "baron-health-bar-remaining-health");
        this.baronBoss = new Element("id", "baron-game-baron-boss");


        this.baronCodeInput = new Element("id", "baron-code-input");
        this.baronCodeSubmitButton = new Element("id", "baron-code-submit-button");

        this.baronAdminViewSwitchButtonWrapper = new Element("id", "baron-admin-view-switch-button-wrapper");
        this.baronAdminViewSwitchButton = new Element("id", "baron-admin-view-switch-button");

        this.returnToLobbyButton = new Element("id", "baron-return-to-lobby");

        this.reset();
    }

    reset(resetPageState = true) {
        this.gameCommsBeingProcessedMap = {};

        this.baronLastHealthPercentage = 0;
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
        if(resetPageState) super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up Baron game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        if(this.isAdmin) {
            setupArgs["isBaron"] = true;
            this.adminPage = this.app.pages.adminGame;
            if(!this.adminPage.createCompleted) {
                let adminPage = this.adminPage.create(setupArgs);
                this.app.mainWrapper.getElement().appendChild(adminPage);
            }
            await this.adminPage.setup(setupArgs);
            this.adminPage.hide();
            this.baronAdminViewSwitchButtonWrapper.getElement().innerHTML = this.createAdminViewSwitchButton();
            this.baronAdminViewSwitchButtonWrapper.show();

            this.baronAdminViewSwitchButton.addEventListener(["click"], () => {
                this.adminPage.show();
                this.hide();
                return;
            });
        } else {
            this.baronAdminViewSwitchButtonWrapper.hide();
        }

        if(this.shouldShowEndGameView()) {
            console.log(`roomId: ${this.roomId}, winningTeam: ${this.winningTeam}, gameEnded: ${this.gameEnded}`);
            this.showEndGameView();
        } else { 
            if(!this.isAdmin){
                // TODO: Refactor into fire?
                this.participantCommsListener = this.app.fire.attachParticipantGameCommsListener(this.roomId, (comms) => {
                    Object.entries(comms).filter(commInfo => {
                        return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
                    }).forEach(commInfo => {
                        this.processGameComms(commInfo[0], commInfo[1]);
                    });
                });
            }

            this.gameStateListener = this.app.fire.attachGameStateListener(this.
                roomId, (gameState) => {
                this.previousGameState = gameState;
                if(GameUtils.isGameInProgress(gameState) && this.baronHealth && this.baronMaxHealth) {
                    this.setBaronHealth(this.baronHealth);
                    this.showBaronContent();
                    this.animateBaronToNewHealth();
                } else if (GameUtils.hasGameEnded(gameState)) {
                    if(GameUtils.isGameInLobby(gameState)) {
                        console.log("=== GAME ENDED ===");
                        this.reset(false);
                        this.gameEnded = true;
                        this.pageState.gameEnded = this.gameEnded;
                        this.app.savePageStateToHistory(true);
                        this.showEndGameView();
                    }
                }
                return;
            });
            this.showLoaderContent();
        }
        super.setup();
    }

    async processGameComms(gameCommId, gameComm) {
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZE_BARON) {
            this.baronMaxHealth = gameComm.data.health;
            this.baronHealth = this.baronMaxHealth;

            let comm = new GameComm(this.getAdminFireUserUidWithAdminFallback(), GAME_COMM_TYPES.INITIALIZATION_DONE, {fireUserUid: this.getAdminFireUserUidWithAdminFallback()});
            await this.sendGameCommToAdminWithAdminFallback(comm);

            this.showBaronView(true);
            this.setBaronHealth(this.baronHealth);
            this.animateBaronToNewHealth();
        } else if(gameComm.commType === GAME_COMM_TYPES.REPORT_BARON_CODE) {
            if(gameComm.data.isValid) {
                let isLastHit = gameComm.data.isLastHit;
                if(isLastHit) {
                    console.log("=== GAME ENDED ===");
                    this.winningTeam = gameComm.data.team;
                    this.gameEnded = true;

                    this.pageState.winningTeam = this.winningTeam;
                    this.pageState.gameEnded = this.gameEnded;
                    this.app.savePageStateToHistory(true);
                }

                this.setBaronHealth(gameComm.data.healthAfterDamage, gameComm.data.damageAmount);
                this.showBaronContent();
                if(isLastHit) {
                    this.animateBaronToNewHealth(() => {
                        setTimeout(() => {this.showEndGameView();}, ONE_SECOND * 2);
                    });
                } else {
                    this.animateBaronToNewHealth();
                }
            } else {
                console.log("Baron code was not valid, please try again");
                this.baronCodeInput.getElement().value = "";
                this.baronCodeInput.getElement().classList.add("wrong");
                if(this.baronCodeInputErrorTimeout) {
                    clearTimeout(this.baronCodeInputErrorTimeout);
                }
                this.baronCodeInputErrorTimeout = setTimeout(() => {
                    this.baronCodeInput.getElement().classList.remove("wrong");
                }, 500);
                this.showBaronContent();
            }
            this.baronCodeInput.getElement().disabled = false;
        } else {
            console.log(`No Baron action done for comm type ${this.commType}`);
            return;
        }
        this.markGameCommProcessedWithAdminFallback(gameCommId);
    }

    getAdminFireUserUidWithAdminFallback() {
        return this.isAdmin ? GAME_ROLES.ADMIN : this.app.fire.fireUser.uid;
    }

    async sendGameCommToAdminWithAdminFallback(comm) {
        if(this.isAdmin) {
            await this.adminPage.processGameComms(comm.id, comm.toFireFormat());
        } else {
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
        }
    }

    async markGameCommProcessedWithAdminFallback(gameCommId) {
        if(this.isAdmin && (gameCommId.split("_")[1] === GAME_ROLES.ADMIN)) {
            console.log(`No need to mark comm ${gameCommId} as processed since user is also Admin`);
        } else {
            await this.app.fire.setParticipantGameCommAsProcessed(this.roomId, gameCommId);
        }
    }

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.isAdmin = setupArgs.isAdmin;
        this.lobbyUserList = setupArgs.lobbyUserList;
        this.winningTeam = setupArgs.winningTeam;
        this.gameEnded = setupArgs.gameEnded;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isAdmin = this.isAdmin;
        this.pageState.lobbyUserList = this.lobbyUserList;
        this.pageState.winningTeam = this.winningTeam;
        this.pageState.gameEnded = this.gameEnded;
    }

    setBaronHealth(health) {
        this.baronHealth = health;
        if(this.baronHealthBar.exists()) {
            if(!this.baronHealthBarRemainingHealth.exists()) {
                this.baronHealthBar.getElement().innerHTML = this.createBaronHealthBarContent();
            }
            this.baronHealthBarText.getElement().innerHTML = this.baronHealth;
        }
    }

    animateBaronToNewHealth(callbackAfterAnimation = null) {
        let remainingPercentageHealth = 100 * this.baronHealth/this.baronMaxHealth;
        if(this.baronHealth === 0) {
            this.baronBoss.getElement().classList.add("dead");
            this.baronBoss.getElement().classList.remove("damaged");
        } else if (remainingPercentageHealth <= 10) {
            this.baronBoss.getElement().classList.remove("dead");
            this.baronBoss.getElement().classList.add("damaged");
        } else {
            this.baronBoss.getElement().classList.remove("dead");
            this.baronBoss.getElement().classList.remove("damaged");
        }
        setTimeout(() => {
            if(this.baronHealthBarRemainingHealth.exists()) {
                this.baronHealthBarRemainingHealth.getElement().style.width = `${remainingPercentageHealth}%`;
            }
            if(callbackAfterAnimation) {
                callbackAfterAnimation();
            }
        }, 100);
        this.baronLastHealthPercentage = remainingPercentageHealth;
    }

    showBaronView(isBufferedView = false) {
        if(this.baronCodeInputErrorTimeout) {
            clearTimeout(this.baronCodeInputErrorTimeout);
        }
        this.showLoaderContent();
        this.baronContent.getElement().innerHTML = this.createBaronContent();
        
        this.baronCodeInput.addEventListener(["input"], () => {
            this.baronCodeInput.getElement().classList.remove("wrong");
            if(this.baronCodeInputErrorTimeout) {
                clearTimeout(this.baronCodeInputErrorTimeout);
            }
            return;
        });
        this.baronCodeSubmitButton.addEventListener(["click"], async () => {
            this.baronCodeInput.getElement().disabled = true;
            let baronCodeInputValue = this.baronCodeInput.getElement().value;
            //send to admin!
            let fireUserUid = this.getAdminFireUserUidWithAdminFallback();
            let comm = new GameComm(fireUserUid, GAME_COMM_TYPES.VERIFY_BARON_CODE, {fireUserUid: fireUserUid, baronCode: baronCodeInputValue});
            await this.sendGameCommToAdminWithAdminFallback(comm);
            return;
        });

        // !isBufferedView - we don't want to show the content if we buffer it; THOUGH we must make sure to call showBaronContent again.
        // isGameInProgress - we show the content straight away since the game has already started!!
        if(!isBufferedView || GameUtils.isGameInProgress(this.previousGameState)) this.showBaronContent();
    }

    shouldShowEndGameView() {
        return !this.roomId || this.winningTeam || this.gameEnded;
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

    createAdminViewSwitchButton() {
        return `
            <button id="${this.baronAdminViewSwitchButton.label}">
                Switch to Admin view
            </button>
        `;
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="${this.pageWrapper.label}" class="v vh-c hv-c">
                <div id="${this.baronAdminViewSwitchButtonWrapper.label}" class="h hv-c vh-c">
                </div>
                <div id="${this.baronContent.label}" class="v vh-c hv-c hide">
                </div>
                ${this.createLoadingContent()}
            </div>
        `;
        
        super.create();
        return page;
    }

    createBaronHealthBarContent() {
        return `
            <div id="${this.baronHealthBarRemainingHealth.label}" style="width:${this.baronLastHealthPercentage}%"></div>
        `;

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
                <div id="${this.baronHealthBarWrapper.label}">
                    <div id="baron-health-bar-text-wrapper" class="h hv-c vh-b">
                        <div class="baron-health-bar-text-ornaments left"></div>
                        <div id="${this.baronHealthBarText.label}">anything</div>
                        <div class="baron-health-bar-text-ornaments right"></div>
                    </div>
                    <div id="${this.baronHealthBar.label}">
                        ${this.createBaronHealthBarContent()}
                    </div>
                </div>
            </div>
            <div class="h hv-c vh-c no-select">
                <img id="${this.baronBoss.label}" src="assets/baron/baron.png"></img>
            </div>
            <div class="h hv-c vh-c">
                <div id="baron-code-input-panel" class="panel h hv-c vh-c">
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
            <div id="${this.loadingContent.label}" class="h hv-c vh-c">
                <img id="baron-game-page-loader" src="assets/ornn/ornn.gif"></img>
            </div>
        `;
    }

    show() {
        super.show();
    }
}