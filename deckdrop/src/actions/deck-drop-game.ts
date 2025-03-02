import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent
} from "@elgato/streamdeck";
import { GameRenderer, EMPTY_SLOT_IMAGE } from "./game-renderer";
import { GameLogic } from "./game-logic";

// Update your GameSettings type:
type GameSettings = {
  currentPlayer: number;
  gameOver: boolean;
  vsAI: boolean;
  aiIsPlayerTwo: boolean;
  player?: string;
  aiStrategy?: 'qlearning' | 'mcts';
  mctsSimulations?: number;
};

type CoordinateKey = string;
type ActionMap = Map<CoordinateKey, any>;

@action({ UUID: "com.practical-engineer.deckdrop.game" })
export class DeckDropGame extends SingletonAction<GameSettings> {
  private gameLogic: GameLogic;
  private renderer: GameRenderer;

  // Map to store actions by coordinates
  private actionLookup: ActionMap = new Map();
  
  // Flag to prevent multiple resets being triggered
  private isResetting: boolean = false;

  constructor() {
    super();
    this.gameLogic = new GameLogic();
    this.renderer = new GameRenderer(this.actionLookup);
    
    // Set the onWin handler
    this.gameLogic.setOnWinHandler(this.renderer.showWinner.bind(this.renderer));
    
    // Set the render callback to ensure the board is rendered after AI moves
    // Using an async wrapper to ensure renders complete properly
    this.gameLogic.setRenderCallback(async (board) => {
      await this.renderer.renderBoard(board);
    });
    
    // Set the game over callback to handle reset logic
    this.gameLogic.setGameOverCallback(() => {
      this.scheduleGameReset();
    });
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

    // Only proceed if we have coordinates
    if (ev.action.coordinates) {
      // If the pressed button is in the top row, make the move
      if (ev.action.coordinates.row === 0) {
        const column = ev.action.coordinates.column;
        const moveResult = this.gameLogic.makeMove(column, this.renderer.showWinner.bind(this.renderer));
        
        // Explicitly render the board after move
        await this.renderer.renderBoard(this.gameLogic.getBoard());
        
        // If the move was successful, check if we need to reset
        if (moveResult) {
          this.scheduleGameReset();
        }
      } else {
        // Button is in a lower row, show valid move indicators
        streamDeck.logger.info('Button in lower row pressed, showing valid move indicators');
        await this.showValidMoveIndicators();
      }
    } else {
      streamDeck.logger.info('Button has no coordinates, no action taken');
    }
  }
  
  /**
   * Shows checkmark indicators on all valid move locations (empty slots in top row)
   */
  private async showValidMoveIndicators(): Promise<void> {
    const board = this.gameLogic.getBoard();
    
    // Show checkmarks on all empty slots in the top row
    for (let col = 0; col < 5; col++) {
      // Get the action for this column in the top row
      const key = this.getCoordinateKey(0, col);
      const action = this.actionLookup.get(key);
      
      if (action) {
        // Only show checkmark if this column isn't full (top slot is empty)
        if (board[0][col] === 0) { // 0 is EMPTY
          await action.showOk(true); // true shows a checkmark
        }
      }
    }
    
    // Clear the indicators after a short delay
    setTimeout(async () => {
      for (let col = 0; col < 5; col++) {
        const key = this.getCoordinateKey(0, col);
        const action = this.actionLookup.get(key);
        if (action) {
          // The showOk effect is temporary, but we can explicitly clear it
          // by setting the image back to what it should be
          const cellValue = board[0][col];
          await this.renderer.setButtonImage(0, col, this.renderer.getImageForCell(cellValue));
        }
      }
    }, 1000); // Clear after 1 second
  }
  
  private scheduleGameReset(): void {
    if (this.gameLogic.isGameOver() && !this.isResetting) {
      this.isResetting = true; // Prevent multiple resets
      
      // Wait for animation to complete then reset
      setTimeout(async () => {
        streamDeck.logger.info("Resetting game after win/draw");
        
        try {
          // Call the async resetGame method and wait for it to complete
          await this.gameLogic.resetGame();
          
          // Force a re-render after reset to ensure UI is updated
          await this.renderer.renderBoard(this.gameLogic.getBoard());
          
          streamDeck.logger.info("Game reset and board re-rendered");
        } catch (error) {
          streamDeck.logger.error("Error during game reset:", error);
        } finally {
          this.isResetting = false; // Reset flag
        }
      }, 7500); // Extended to 7.5 seconds to ensure animations complete fully
    }
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<GameSettings>
  ): Promise<void> {
    streamDeck.logger.info('Received settings:', ev.payload.settings);
    
    // Handle the player selection setting
    if (ev.payload.settings?.player) {
      const playerChoice = ev.payload.settings.player;
      streamDeck.logger.info(`Player selection changed to: ${playerChoice}`);
      
      // Update AI player based on user's selection
      const aiIsPlayerTwo = playerChoice === 'player1';
      this.gameLogic.setAIPlayer(aiIsPlayerTwo);
    }
    
    // Handle AI strategy selection
    if (ev.payload.settings?.aiStrategy) {
      const strategy = ev.payload.settings.aiStrategy;
      const simulations = ev.payload.settings.mctsSimulations || 5000;
      
      streamDeck.logger.info(`AI strategy changed to: ${strategy}`);
      this.gameLogic.setAIStrategy(strategy, simulations);
    }
    
    // Reset the game for a fresh start with the new settings
    if (!this.isResetting) {
      await this.gameLogic.resetGame();
      await this.renderer.renderBoard(this.gameLogic.getBoard());
    }
  }  
}
