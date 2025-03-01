import streamDeck from "@elgato/streamdeck";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import { qTableData } from "./q-table";

export class AIOpponent {
  private qTable: Record<string, Record<string, number>>;
  public isPlayerTwo: boolean = true; // AI is player 2 by default
  
  constructor() {
    this.qTable = qTableData;
    streamDeck.logger.info(`Loaded Q-table with ${Object.keys(this.qTable).length} states`);
  }
  
  /**
   * Get the best action (column) for the current board state
   * @param board Current game board
   * @returns Column index (0-4) for the best move
   */
  public getBestMove(board: number[][]): number {
    // Convert board to state representation
    const state = this.boardToState(board);
    streamDeck.logger.info(`Current state: ${state}`);
    
    // Get valid actions (columns that aren't full)
    const validActions = this.getValidActions(board);
    streamDeck.logger.info(`Valid actions: ${validActions}`);
    
    if (validActions.length === 0) {
      streamDeck.logger.warn('No valid actions available');
      return -1;
    }
    
    // Check if we have this state in our Q-table
    if (!(state in this.qTable)) {
      streamDeck.logger.info(`State not found in Q-table, using column preference`);
      // If state not in Q-table, use column preference heuristic
      // Prefer middle column, then columns near middle, then edges
      const preferenceOrder = [2, 1, 3, 0, 4];
      for (const col of preferenceOrder) {
        if (validActions.includes(col)) {
          return col;
        }
      }
      return validActions[0]; // Fallback to first valid action
    }
    
    // Find best action based on Q-values
    let bestAction = -1;
    let bestValue = -Infinity;
    
    for (const action of validActions) {
      const actionStr = action.toString();
      const qValue = this.qTable[state][actionStr] || 0;
      streamDeck.logger.info(`Q-value for action ${action}: ${qValue}`);
      
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }
    
    if (bestAction === -1) {
      // If no good move found, fallback to middle column heuristic
      const preferenceOrder = [2, 1, 3, 0, 4];
      for (const col of preferenceOrder) {
        if (validActions.includes(col)) {
          return col;
        }
      }
      return validActions[0]; // Fallback to first valid action
    }
    
    return bestAction;
  }
  
  /**
   * Convert the game board to a state string representation
   * @param board The current game board
   * @returns State string
   */
  private boardToState(board: number[][]): string {
    // If AI is player 2, we don't need to flip the perspective
    if (this.isPlayerTwo) {
      return board.flat().join('');
    }
    
    // If AI is player 1, we need to flip the perspective
    // since the Q-learning was trained with player 1 as the agent
    const flippedBoard = board.map(row => 
      row.map(cell => {
        if (cell === EMPTY) return EMPTY;
        return cell === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
      })
    );
    
    return flippedBoard.flat().join('');
  }
  
  /**
   * Get list of valid actions (columns that aren't full)
   * @param board Current game board
   * @returns Array of valid column indices
   */
  private getValidActions(board: number[][]): number[] {
    const validActions: number[] = [];
    
    // Check top row for each column
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        validActions.push(col);
      }
    }
    
    return validActions;
  }
  
  /**
   * Set which player the AI plays as
   * @param isPlayerTwo true if AI is player 2, false if AI is player 1
   */
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.isPlayerTwo = isPlayerTwo;
  }
}
