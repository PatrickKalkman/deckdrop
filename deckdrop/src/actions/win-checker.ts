export class WinChecker {
  /**
   * Check if the last move resulted in a win
   */
  public checkWinner(board: number[][], row: number, col: number, showWinnerCallback: (positions: [number, number][], player: number) => void): boolean {
    const player = board[row][col];
    
    // Check each win condition
    return (
      this.checkHorizontalWin(board, row, player, showWinnerCallback) ||
      this.checkVerticalWin(board, col, player, showWinnerCallback) ||
      this.checkDiagonalDownWin(board, player, showWinnerCallback) ||
      this.checkDiagonalUpWin(board, player, showWinnerCallback)
    );
  }

  /**
   * Check for horizontal win (row-based)
   */
  private checkHorizontalWin(board: number[][], row: number, player: number, showWinnerCallback: (positions: [number, number][], player: number) => void): boolean {
    const winningPositions: [number, number][] = [];
    let count = 0;
    let startCol = 0;
    
    for (let c = 0; c < 5; c++) {
      if (board[row][c] === player) {
        if (count === 0) startCol = c;
        count++;
        if (count === 3) {
          for (let i = 0; i < 3; i++) {
            winningPositions.push([row, startCol + i]);
          }
          showWinnerCallback(winningPositions, player);
          return true;
        }
      } else {
        count = 0;
      }
    }
    
    return false;
  }

  /**
   * Check for vertical win (column-based)
   */
  private checkVerticalWin(board: number[][], col: number, player: number, showWinnerCallback: (positions: [number, number][], player: number) => void): boolean {
    const winningPositions: [number, number][] = [];
    let count = 0;
    let startRow = 0;
    
    for (let r = 0; r < 3; r++) {
      if (board[r][col] === player) {
        if (count === 0) startRow = r;
        count++;
        if (count === 3) {
          for (let i = 0; i < 3; i++) {
            winningPositions.push([startRow + i, col]);
          }
          showWinnerCallback(winningPositions, player);
          return true;
        }
      } else {
        count = 0;
      }
    }
    
    return false;
  }

  /**
   * Check for diagonal win (top-left to bottom-right)
   */
  private checkDiagonalDownWin(board: number[][], player: number, showWinnerCallback: (positions: [number, number][], player: number) => void): boolean {
    const winningPositions: [number, number][] = [];
    
    // Can only start from row 0
    for (let r = 0; r <= 0; r++) {
      // Can only start from columns 0, 1, or 2
      for (let c = 0; c <= 2; c++) {
        // Make sure we don't go out of bounds
        if (r+2 < 3 && c+2 < 5) {
          if (
            board[r][c] === player &&
            board[r+1][c+1] === player &&
            board[r+2][c+2] === player
          ) {
            winningPositions.push([r, c]);
            winningPositions.push([r+1, c+1]);
            winningPositions.push([r+2, c+2]);
            showWinnerCallback(winningPositions, player);
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check for diagonal win (bottom-left to top-right)
   */
  private checkDiagonalUpWin(board: number[][], player: number, showWinnerCallback: (positions: [number, number][], player: number) => void): boolean {
    const winningPositions: [number, number][] = [];
    
    // Can only start from row 2
    for (let r = 2; r >= 2; r--) {
      // Can only start from columns 0, 1, or 2
      for (let c = 0; c <= 2; c++) {
        // Make sure we don't go out of bounds
        if (r-2 >= 0 && c+2 < 5) {
          if (
            board[r][c] === player &&
            board[r-1][c+1] === player &&
            board[r-2][c+2] === player
          ) {
            winningPositions.push([r, c]);
            winningPositions.push([r-1, c+1]);
            winningPositions.push([r-2, c+2]);
            showWinnerCallback(winningPositions, player);
            return true;
          }
        }
      }
    }
    
    return false;
  }
}
