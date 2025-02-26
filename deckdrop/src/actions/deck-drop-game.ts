import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";
import { GameRenderer } from "./game-renderer";
import { GameLogic } from "./game-logic";

type GameSettings = {
  currentPlayer: number; 
  gameOver: boolean;
  isController: boolean; // Flag to identify controller button
};

type CoordinateKey = string;
type ActionMap = Map<CoordinateKey, any>;

@action({ UUID: "com.practical-engineer.deckdrop.game" })
export class DeckDropGame extends SingletonAction<GameSettings> {
  private gameLogic: GameLogic;
  private renderer: GameRenderer;

  // Map to store actions by coordinates
  private actionLookup: ActionMap = new Map();

  constructor() {
    super();
    this.gameLogic = new GameLogic();
    this.renderer = new GameRenderer(this.actionLookup);
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
    
    // Store action reference in our lookup map if it has coordinates
    if (ev.action.coordinates) {
      const col = ev.action.coordinates.column;
      const row = ev.action.coordinates.row;
      const key = this.getCoordinateKey(row, col);
      this.actionLookup.set(key, ev.action);
      streamDeck.logger.info(`Stored action at coordinates [${row}, ${col}]`);
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
  }

  // Track if we've already switched to the DeckDrop profile
  private hasProfileSwitched: boolean = false;
  
  override async onWillDisappear(ev: WillDisappearEvent<GameSettings>): Promise<void> {
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


}
