import numpy as np


class ConnectThreeEnv:
    """
    Connect Three environment on a 3x5 board.
    This environment follows the rules of the DeckDrop game.

    Enhanced with intermediate rewards for partial patterns.
    """

    def __init__(self, intermediate_rewards=True):
        # Board is 3x5, 0 for empty, 1 for player 1, 2 for player 2
        self.board = np.zeros((3, 5), dtype=int)
        self.current_player = 1
        self.done = False
        self.winner = None
        self.intermediate_rewards = intermediate_rewards
        # Keep track of previous state for calculating state-based rewards
        self.previous_player_state = {1: None, 2: None}

    def reset(self):
        """Reset the environment for a new game."""
        self.board = np.zeros((3, 5), dtype=int)
        self.current_player = 1
        self.done = False
        self.winner = None
        self.previous_player_state = {1: None, 2: None}
        return self._get_state()

    def step(self, action):
        """
        Take an action (column selection) and return the new state, reward, and done flag.

        Args:
            action: Column to drop the piece (0-4)

        Returns:
            state: The new state representation
            reward: Reward for the action
            done: Whether the game is finished
            info: Additional information
        """
        info = {}

        # Check if the action is valid
        if not self._is_valid_action(action):
            return self._get_state(), -10, self.done, {"invalid_move": True}

        # Store the previous state value for this player
        self.previous_player_state[self.current_player] = self._calculate_state_value(self.current_player)

        # Drop the piece in the selected column
        row = self._get_next_open_row(action)
        self.board[row][action] = self.current_player

        # Check for win
        if self._check_win():
            self.done = True
            self.winner = self.current_player
            reward = 1.0 if self.current_player == 1 else -1.0
            return self._get_state(), reward, self.done, {"winner": self.current_player}

        # Check for draw
        if self._is_board_full():
            self.done = True
            reward = 0.2  # Small positive reward for draw
            return self._get_state(), reward, self.done, {"draw": True}

        # Calculate rewards based on state improvement
        reward = -0.05  # Small negative reward for non-terminal move (encourages faster winning)

        # Add intermediate rewards if enabled
        if self.intermediate_rewards:
            current_state_value = self._calculate_state_value(self.current_player)
            previous_state_value = self.previous_player_state[self.current_player] or 0

            # Calculate change in state value
            state_improvement = current_state_value - previous_state_value

            # Add scaled intermediate reward
            if state_improvement > 0:
                reward += 0.1 * state_improvement  # Scale factor can be tuned
                info["pattern_reward"] = 0.1 * state_improvement

        # Switch player
        self.current_player = 3 - self.current_player  # 1 -> 2, 2 -> 1

        return self._get_state(), reward, self.done, info

    def _get_next_open_row(self, col):
        """Find the next open row in the given column."""
        for r in range(2, -1, -1):  # Start from bottom row
            if self.board[r][col] == 0:
                return r
        return -1  # Column is full

    def _is_valid_action(self, action):
        """Check if the action is valid."""
        if action < 0 or action >= 5:  # Out of bounds
            return False
        return self.board[0][action] == 0  # Top row must be empty

    def _is_board_full(self):
        """Check if the board is full."""
        return (self.board != 0).all()

    def _check_win(self):
        """Check if the current player has won (connected three pieces)."""
        player = self.current_player
        board = self.board

        # Check horizontal
        for r in range(3):
            for c in range(3):  # Up to 3 to check 3 in a row
                if board[r][c] == player and board[r][c + 1] == player and board[r][c + 2] == player:
                    return True

        # Check vertical
        for r in range(1):  # Only bottom row can start a vertical win (3 rows total)
            for c in range(5):
                if board[r][c] == player and board[r + 1][c] == player and board[r + 2][c] == player:
                    return True

        # Check diagonal (/)
        for r in range(2, 3):  # Start from bottom rows
            for c in range(3):  # Up to 3 to check 3 in a row
                if board[r][c] == player and board[r - 1][c + 1] == player and board[r - 2][c + 2] == player:
                    return True

        # Check diagonal (\)
        for r in range(1):  # Start from top rows
            for c in range(3):  # Up to 3 to check 3 in a row
                if board[r][c] == player and board[r + 1][c + 1] == player and board[r + 2][c + 2] == player:
                    return True

        return False

    def _calculate_state_value(self, player):
        """
        Enhanced state value calculation with improved recognition of:
        - Immediate threats (must-block situations)
        - Fork opportunities (multiple threats)
        - Blocking value based on threat urgency
        - Strategic positions
        
        Returns:
            float: A value representing the "goodness" of the state for the player
        """
        board = self.board
        opponent = 3 - player
        state_value = 0
        
        # Track immediate threats for both players
        player_immediate_threats = 0
        opponent_immediate_threats = 0
        player_potential_threats = 0
        opponent_potential_threats = 0
        
        # --- Check for immediate winning moves (highest priority) ---
        
        # Check horizontal immediate threats
        for r in range(3):
            for c in range(3):
                # Player's immediate winning move
                if (
                    (board[r][c] == player and board[r][c+1] == player and board[r][c+2] == 0 and (r == 2 or board[r+1][c+2] != 0)) or
                    (board[r][c] == player and board[r][c+1] == 0 and board[r][c+2] == player and (r == 2 or board[r+1][c+1] != 0)) or
                    (board[r][c] == 0 and board[r][c+1] == player and board[r][c+2] == player and (r == 2 or board[r+1][c] != 0))
                ):
                    player_immediate_threats += 1
                    state_value += 3.0  # Highly value immediate winning moves
                
                # Opponent's immediate winning move
                if (
                    (board[r][c] == opponent and board[r][c+1] == opponent and board[r][c+2] == 0 and (r == 2 or board[r+1][c+2] != 0)) or
                    (board[r][c] == opponent and board[r][c+1] == 0 and board[r][c+2] == opponent and (r == 2 or board[r+1][c+1] != 0)) or
                    (board[r][c] == 0 and board[r][c+1] == opponent and board[r][c+2] == opponent and (r == 2 or board[r+1][c] != 0))
                ):
                    opponent_immediate_threats += 1
                    state_value += 2.5  # Highly value blocking opponent's wins

                # Two horizontal with open third (potential threats)
                if (
                    (board[r][c] == player and board[r][c + 1] == player and board[r][c + 2] == 0) or
                    (board[r][c] == player and board[r][c + 1] == 0 and board[r][c + 2] == player) or
                    (board[r][c] == 0 and board[r][c + 1] == player and board[r][c + 2] == player)
                ):
                    player_potential_threats += 1
                    state_value += 1.0

                # Opponent two horizontal with open third (defensive value)
                if (
                    (board[r][c] == opponent and board[r][c + 1] == opponent and board[r][c + 2] == 0) or
                    (board[r][c] == opponent and board[r][c + 1] == 0 and board[r][c + 2] == opponent) or
                    (board[r][c] == 0 and board[r][c + 1] == opponent and board[r][c + 2] == opponent)
                ):
                    opponent_potential_threats += 1
                    state_value += 0.5  # Defensive value is worth less than offensive

        # Check vertical immediate threats
        for r in range(1):
            for c in range(5):
                # Player's immediate vertical winning move
                if board[r][c] == player and board[r+1][c] == player and board[r+2][c] == 0:
                    player_immediate_threats += 1
                    state_value += 3.0
                
                # Opponent's immediate vertical winning move
                if board[r][c] == opponent and board[r+1][c] == opponent and board[r+2][c] == 0:
                    opponent_immediate_threats += 1
                    state_value += 2.5

                # Two vertical with open third (potential threats)
                if (
                    (board[r][c] == player and board[r + 1][c] == player and board[r + 2][c] == 0) or
                    (board[r][c] == player and board[r + 1][c] == 0 and board[r + 2][c] == player) or
                    (board[r][c] == 0 and board[r + 1][c] == player and board[r + 2][c] == player)
                ):
                    player_potential_threats += 1
                    state_value += 1.0

                # Opponent two vertical with open third (defensive value)
                if (
                    (board[r][c] == opponent and board[r + 1][c] == opponent and board[r + 2][c] == 0) or
                    (board[r][c] == opponent and board[r + 1][c] == 0 and board[r + 2][c] == opponent) or
                    (board[r][c] == 0 and board[r + 1][c] == opponent and board[r + 2][c] == opponent)
                ):
                    opponent_potential_threats += 1
                    state_value += 0.5

        # Check diagonal immediate threats (/)
        for r in range(2, 3):
            for c in range(3):
                # Player's immediate diagonal (/) winning move
                if (
                    (board[r][c] == player and board[r-1][c+1] == player and board[r-2][c+2] == 0) or
                    (board[r][c] == player and board[r-1][c+1] == 0 and board[r-2][c+2] == player) or
                    (board[r][c] == 0 and board[r-1][c+1] == player and board[r-2][c+2] == player)
                ):
                    player_immediate_threats += 1
                    state_value += 3.0
                
                # Opponent's immediate diagonal (/) winning move
                if (
                    (board[r][c] == opponent and board[r-1][c+1] == opponent and board[r-2][c+2] == 0) or
                    (board[r][c] == opponent and board[r-1][c+1] == 0 and board[r-2][c+2] == opponent) or
                    (board[r][c] == 0 and board[r-1][c+1] == opponent and board[r-2][c+2] == opponent)
                ):
                    opponent_immediate_threats += 1
                    state_value += 2.5

                # Two diagonal / with open third (potential threats)
                if (
                    (board[r][c] == player and board[r - 1][c + 1] == player and board[r - 2][c + 2] == 0) or
                    (board[r][c] == player and board[r - 1][c + 1] == 0 and board[r - 2][c + 2] == player) or
                    (board[r][c] == 0 and board[r - 1][c + 1] == player and board[r - 2][c + 2] == player)
                ):
                    player_potential_threats += 1
                    state_value += 1.0

                # Opponent two diagonal / with open third (defensive value)
                if (
                    (board[r][c] == opponent and board[r - 1][c + 1] == opponent and board[r - 2][c + 2] == 0) or
                    (board[r][c] == opponent and board[r - 1][c + 1] == 0 and board[r - 2][c + 2] == opponent) or
                    (board[r][c] == 0 and board[r - 1][c + 1] == opponent and board[r - 2][c + 2] == opponent)
                ):
                    opponent_potential_threats += 1
                    state_value += 0.5

        # Check diagonal immediate threats (\)
        for r in range(1):
            for c in range(3):
                # Player's immediate diagonal (\) winning move
                if (
                    (board[r][c] == player and board[r+1][c+1] == player and board[r+2][c+2] == 0) or
                    (board[r][c] == player and board[r+1][c+1] == 0 and board[r+2][c+2] == player) or
                    (board[r][c] == 0 and board[r+1][c+1] == player and board[r+2][c+2] == player)
                ):
                    player_immediate_threats += 1
                    state_value += 3.0
                
                # Opponent's immediate diagonal (\) winning move
                if (
                    (board[r][c] == opponent and board[r+1][c+1] == opponent and board[r+2][c+2] == 0) or
                    (board[r][c] == opponent and board[r+1][c+1] == 0 and board[r+2][c+2] == opponent) or
                    (board[r][c] == 0 and board[r+1][c+1] == opponent and board[r+2][c+2] == opponent)
                ):
                    opponent_immediate_threats += 1
                    state_value += 2.5

                # Two diagonal \ with open third (potential threats)
                if (
                    (board[r][c] == player and board[r + 1][c + 1] == player and board[r + 2][c + 2] == 0) or
                    (board[r][c] == player and board[r + 1][c + 1] == 0 and board[r + 2][c + 2] == player) or
                    (board[r][c] == 0 and board[r + 1][c + 1] == player and board[r + 2][c + 2] == player)
                ):
                    player_potential_threats += 1
                    state_value += 1.0

                # Opponent two diagonal \ with open third (defensive value)
                if (
                    (board[r][c] == opponent and board[r + 1][c + 1] == opponent and board[r + 2][c + 2] == 0) or
                    (board[r][c] == opponent and board[r + 1][c + 1] == 0 and board[r + 2][c + 2] == opponent) or
                    (board[r][c] == 0 and board[r + 1][c + 1] == opponent and board[r + 2][c + 2] == opponent)
                ):
                    opponent_potential_threats += 1
                    state_value += 0.5
        
        # --- Fork detection (multiple threats) ---
        
        # If player has 2+ immediate threats, that's a fork (almost guaranteed win)
        if player_immediate_threats >= 2:
            state_value += 5.0  # Extremely valuable
        
        # If opponent has 2+ immediate threats, that's a defensive emergency
        if opponent_immediate_threats >= 2:
            state_value -= 1.0  # This is bad for us - can only block one
        
        # --- Strategic position evaluation ---
        
        # Center control (more nuanced than before)
        # Bottom row center is most valuable
        if board[2][2] == player:
            state_value += 0.4  # Bottom center is prime real estate
        
        # Middle column control (refined)
        center_control = sum(1 for r in range(3) if board[r][2] == player)
        state_value += 0.3 * center_control
        
        # Add value for center positions (usually strategically better)
        for r in range(3):
            for c in range(1, 4):  # middle 3 columns
                if board[r][c] == player:
                    state_value += 0.2
        
        # First-move advantage (if player is player 1)
        if player == 1 and np.sum(board != 0) <= 2:
            # In early game, player 1 should take center positions
            state_value += 0.2 * sum(1 for r in range(3) for c in range(1, 4) if board[r][c] == player)
        
        return state_value

    def _get_state(self):
        """Convert the current board to a state representation."""
        # Simple string representation of the board
        return "".join([str(cell) for row in self.board for cell in row])

    def get_valid_actions(self):
        """Return a list of valid actions."""
        return [col for col in range(5) if self._is_valid_action(col)]

    def render(self):
        """Print the current board state."""
        print("  0 1 2 3 4")  # Column numbers
        print(" -----------")
        for r in range(3):
            print("|", end=" ")
            for c in range(5):
                if self.board[r][c] == 0:
                    print(".", end=" ")
                elif self.board[r][c] == 1:
                    print("X", end=" ")
                else:
                    print("O", end=" ")
            print("|")
        print(" -----------")
