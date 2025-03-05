import streamDeck from "@elgato/streamdeck";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import Groq from 'groq-sdk';

// Default model to use
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export class GroqOpponent {
  private groq: any;
  public isPlayerTwo: boolean = true;
  private model: string = DEFAULT_GROQ_MODEL;
  private apiKey: string = "";
  private isInitialized: boolean = false;

  constructor(apiKey: string = "", model: string = DEFAULT_GROQ_MODEL) {
    this.model = model;
    if (apiKey) {
      this.initialize(apiKey);
    }
  }

  /**
   * Initialize the Groq client with API key
   */
  public initialize(apiKey: string): void {
    try {
      this.apiKey = apiKey;
      this.groq = new Groq({ apiKey });
      this.isInitialized = true;
      streamDeck.logger.info(`Initialized Groq client with model: ${this.model}`);
    } catch (error) {
      streamDeck.logger.error(`Failed to initialize Groq client: ${error}`);
      this.isInitialized = false;
    }
  }

  /**
   * Get the best move using Groq LLM
   * @param board Current game board
   * @returns Column index (0-4) for the best move
   */
  public async getBestMove(board: number[][]): Promise<number> {
    if (!this.isInitialized) {
      streamDeck.logger.error("Groq client not initialized. Please set API key first.");
      return this.getFallbackMove(board);
    }

    try {
      // Convert board to a human-readable format for the LLM
      const boardRepresentation = this.formatBoardForLLM(board);
      const playerSymbol = this.isPlayerTwo ? "O" : "X";
      
      // Create the prompt for the LLM
      const prompt = `You are playing a Connect-3 game on a 3x5 grid. You need to get 3 in a row horizontally, vertically, or diagonally to win.
Current board state (X = player 1, O = player 2, . = empty):
${boardRepresentation}

You are playing as ${playerSymbol}. The columns are numbered 0-4 from left to right.
Analyze the board carefully and return ONLY a single digit (0-4) representing the column where you want to place your token.
Choose the best strategic move. If a column is full, you cannot place a token there.`;

      // Call the Groq API
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.model,
        temperature: 0.2, // Lower temperature for more deterministic responses
        max_tokens: 10,   // We only need a single digit
        top_p: 1,
        stream: false,
        stop: null
      });

      // Extract the move from the response
      const response = chatCompletion.choices[0]?.message?.content?.trim() || "";
      streamDeck.logger.info(`Groq response: ${response}`);
      
      // Parse the response to get a valid column number
      const move = this.parseMove(response, board);
      streamDeck.logger.info(`Groq selected column: ${move}`);
      
      return move;
    } catch (error) {
      streamDeck.logger.error(`Error calling Groq API: ${error}`);
      return this.getFallbackMove(board);
    }
  }

  /**
   * Set which player the AI plays as
   * @param isPlayerTwo true if AI is player 2, false if AI is player 1
   */
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.isPlayerTwo = isPlayerTwo;
  }

  /**
   * Set the model to use
   * @param model The Groq model name
   */
  public setModel(model: string): void {
    this.model = model;
    streamDeck.logger.info(`Changed Groq model to: ${model}`);
  }

  /**
   * Format the board in a human-readable way for the LLM
   */
  private formatBoardForLLM(board: number[][]): string {
    let result = "";
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        if (board[row][col] === EMPTY) {
          result += ". ";
        } else if (board[row][col] === PLAYER_ONE) {
          result += "X ";
        } else {
          result += "O ";
        }
      }
      result += "\n";
    }
    return result;
  }

  /**
   * Parse the LLM's response to get a valid move
   */
  private parseMove(response: string, board: number[][]): number {
    // Try to extract a digit from the response
    const match = response.match(/[0-4]/);
    if (match) {
      const column = parseInt(match[0], 10);
      
      // Check if the column is valid and not full
      if (column >= 0 && column <= 4 && board[0][column] === EMPTY) {
        return column;
      }
    }
    
    // If we couldn't get a valid move, use fallback
    return this.getFallbackMove(board);
  }

  /**
   * Provide a fallback move when the API fails or returns invalid move
   */
  private getFallbackMove(board: number[][]): number {
    // Get valid moves
    const validMoves: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        validMoves.push(col);
      }
    }
    
    if (validMoves.length === 0) {
      return -1;
    }
    
    // Prefer center column, then columns near center, then edges
    const preferenceOrder = [2, 1, 3, 0, 4];
    for (const col of preferenceOrder) {
      if (validMoves.includes(col)) {
        return col;
      }
    }
    
    return validMoves[0];
  }
}
