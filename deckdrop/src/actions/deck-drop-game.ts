import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";
import { GameRenderer, EMPTY_SLOT_IMAGE } from "./game-renderer";
import { GameLogic } from "./game-logic";

type GameSettings = {
  currentPlayer: number; 
  gameOver: boolean;
  isController: boolean; // Flag to identify controller button
  vsAI: boolean; // Flag for AI mode
  aiIsPlayerTwo: boolean; // Flag for which player AI controls
};

type CoordinateKey = string;
type ActionMap = Map<CoordinateKey, any>;

@action({ UUID: "com.practical-engineer.deckdrop.game" })
export class DeckDropGame extends SingletonAction<GameSettings> {
  private gameLogic: GameLogic;
  private renderer: GameRenderer;

  // Map to store actions by coordinates
  private actionLookup: ActionMap = new Map();
  
  // Controller action reference
  private controllerAction: any = null;

  constructor() {
    super();
    this.gameLogic = new GameLogic();
    this.renderer = new GameRenderer(this.actionLookup);
    
    // Set the onWin handler
    this.gameLogic.setOnWinHandler(this.renderer.showWinner.bind(this.renderer));
    
    // Set the render callback to ensure the board is rendered after AI moves
    this.gameLogic.setRenderCallback(this.renderer.renderBoard.bind(this.renderer));
  }

  private getCoordinateKey(row: number, col: number): CoordinateKey {
    return `${row},${col}`;
  } 

  /**
   * Occurs when the action appears on Stream Deck
   */
  override async onWillAppear(ev: WillAppearEvent<GameSettings>): Promise<void> {
    // Log event info for debugging
    streamDeck.logger.info('Action appeared:', {
      actionId: ev.action.id,
      coordinates: ev.action.coordinates,
      settings: ev.payload.settings
    });
    
    // Check if this is a controller button
    if (ev.payload.settings?.isController) {
      this.controllerAction = ev.action;
      streamDeck.logger.info('Stored controller action');
      
      // Apply controller button settings
      if (ev.payload.settings?.vsAI !== undefined) {
        this.gameLogic.setVsAI(ev.payload.settings.vsAI);
        streamDeck.logger.info(`AI mode set to: ${ev.payload.settings.vsAI}`);
      }
      
      if (ev.payload.settings?.aiIsPlayerTwo !== undefined) {
        this.gameLogic.setAIPlayer(ev.payload.settings.aiIsPlayerTwo);
        streamDeck.logger.info(`AI is player two: ${ev.payload.settings.aiIsPlayerTwo}`);
      }
      
      // Set controller button image based on mode
      this.updateControllerImage(
        ev.payload.settings?.vsAI ?? true,
        ev.payload.settings?.aiIsPlayerTwo ?? true
      );
      
      return;
    }
    
    // Store action reference in our lookup map if it has coordinates
    if (ev.action.coordinates) {
      const col = ev.action.coordinates.column;
      const row = ev.action.coordinates.row;
      const key = this.getCoordinateKey(row, col);
      this.actionLookup.set(key, ev.action);
      streamDeck.logger.info(`Stored action at coordinates [${row}, ${col}]`);
      
      // Set initial image
      await this.renderer.setButtonImage(row, col, EMPTY_SLOT_IMAGE);
    }
    
    // Switch to the DeckDrop profile if we haven't already
    if (!this.hasProfileSwitched) {
      try {
        await streamDeck.profiles.switchToProfile(ev.action.device.id, "DeckDrop");
        this.hasProfileSwitched = true;
        streamDeck.logger.info('Switched to DeckDrop profile');
      } catch (error) {
        streamDeck.logger.error(`Failed to switch profile: ${error}`);
      }
    }
    
    // Render the board
    await this.renderer.renderBoard(this.gameLogic.getBoard());
  }

  // Track if we've already switched to the DeckDrop profile
  private hasProfileSwitched: boolean = false;
  
  override async onWillDisappear(ev: WillDisappearEvent<GameSettings>): Promise<void> {
    // Check if this is the controller disappearing
    if (ev.payload.settings?.isController && this.controllerAction?.id === ev.action.id) {
      this.controllerAction = null;
      streamDeck.logger.info('Controller action removed');
      return;
    }
    
    // Find and remove the action from our lookup map
    for (const [key, storedAction] of this.actionLookup.entries()) {
      if (storedAction.id === ev.action.id) {
        this.actionLookup.delete(key);
        streamDeck.logger.info(`Removed action with ID ${ev.action.id} from lookup map`);
        break;
      }
    }
    
    streamDeck.logger.info('Action disappeared');
  }

  override async onKeyDown(ev: KeyDownEvent<GameSettings>): Promise<void> {
    streamDeck.logger.info('Key pressed:', {
      actionId: ev.action.id,
      coordinates: ev.action.coordinates,
      settings: ev.payload.settings
    });

    // Check if the pressed button is in the top row (row=0)
    if (ev.action.coordinates && ev.action.coordinates.row === 0) {
      const column = ev.action.coordinates.column;
      const moveResult = this.gameLogic.makeMove(column, this.renderer.showWinner.bind(this.renderer));
      this.renderer.renderBoard(this.gameLogic.getBoard());
      
      // If the game is over, schedule a reset
      if (moveResult && this.gameLogic.isGameOver()) {
        setTimeout(() => {
          this.gameLogic.resetGame();
          this.renderer.renderBoard(this.gameLogic.getBoard());
        }, 5000); // Wait for animation to complete (5 seconds)
      }
    } else {
      streamDeck.logger.info('Button not in top row, no action taken');
    }
  }
  
  /**
   * Update the controller button image based on game mode
   */
  private async updateControllerImage(vsAI: boolean, aiIsPlayerTwo: boolean): Promise<void> {
    if (!this.controllerAction) return;
    
    let imagePath = '';
    
    if (!vsAI) {
      imagePath = 'imgs/actions/deckdrop/controller-2player.svg';
    } else if (aiIsPlayerTwo) {
      imagePath = 'imgs/actions/deckdrop/controller-ai-p2.svg';
    } else {
      imagePath = 'imgs/actions/deckdrop/controller-ai-p1.svg';
    }
    
    try {
      await this.controllerAction.setImage(imagePath);
      streamDeck.logger.info(`Set controller image to ${imagePath}`);
    } catch (error) {
      streamDeck.logger.error('Failed to set controller image:', error);
    }
  }
}