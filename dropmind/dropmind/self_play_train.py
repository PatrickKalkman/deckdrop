import argparse
import copy
import os
import time

import matplotlib.pyplot as plt
import numpy as np
from agent import QLearningAgent
from environment import ConnectThreeEnv
from tqdm import tqdm


def self_play_train(
    episodes=10000,
    save_interval=1000,
    learning_rate=0.1,
    discount_factor=0.9,
    exploration_rate=1.0,
    exploration_decay=0.995,
    min_exploration_rate=0.01,
    opponent_update_interval=500,
    save_json=True,
    render_interval=0,
):
    """
    Train the Q-learning agent using self-play with alternating player roles.
    """
    # Create output directories
    os.makedirs("./dropmind/models", exist_ok=True)
    os.makedirs("./dropmind/graphs", exist_ok=True)

    # Initialize environment and agents
    env = ConnectThreeEnv()

    # Primary agent (learns continuously)
    primary_agent = QLearningAgent(
        learning_rate=learning_rate,
        discount_factor=discount_factor,
        exploration_rate=exploration_rate,
        exploration_decay=exploration_decay,
        min_exploration_rate=min_exploration_rate,
    )

    # Opponent agent (updated periodically from primary agent)
    opponent_agent = copy.deepcopy(primary_agent)

    # Metrics
    primary_wins = []
    opponent_wins = []
    draws = []
    rewards = []
    q_table_sizes = []
    exploration_rates = []
    elo_ratings = [1000]  # Starting ELO rating

    start_time = time.time()

    # Training loop
    for episode in tqdm(range(episodes)):
        state = env.reset()

        # Alternate which player the primary agent plays as
        primary_agent_player = (episode % 2) + 1  # 1 for odd episodes, 2 for even
        is_primary_turn = env.current_player == primary_agent_player

        total_reward = 0
        game_steps = 0
        actions_taken = []  # Store actions for analysis

        # Play an episode
        while not env.done:
            # Get valid actions
            valid_actions = env.get_valid_actions()

            if not valid_actions:
                break

            # Choose an action based on which agent's turn it is
            if is_primary_turn:  # Primary agent's turn
                action = primary_agent.get_action(state, valid_actions)
                actions_taken.append(action)
            else:  # Opponent agent's turn
                opp_state = state
                if primary_agent_player == 1:  # Primary is player 1, convert for player 2
                    opp_state = _convert_state_for_opponent(state)
                action = opponent_agent.get_action(opp_state, valid_actions)

            # Take the action
            next_state, reward, done, info = env.step(action)

            # Get valid actions for next state
            next_valid_actions = []
            if not done:
                next_valid_actions = env.get_valid_actions()

            # Update Q-values for primary agent based on its perspective
            if is_primary_turn:
                primary_agent.update(state, action, reward, next_state, next_valid_actions)
            else:
                # For opponent's move, we update primary agent with inverted reward
                if primary_agent_player == 1:  # Primary is player 1
                    opp_state = _convert_state_for_opponent(state)
                    opp_next_state = _convert_state_for_opponent(next_state)
                    primary_agent.update(opp_state, action, -reward, opp_next_state, next_valid_actions)
                else:  # Primary is player 2
                    primary_agent.update(state, action, -reward, next_state, next_valid_actions)

            state = next_state
            total_reward += reward if is_primary_turn else -reward
            game_steps += 1
            is_primary_turn = env.current_player == primary_agent_player  # Update turn

            # Render game if requested
            if render_interval > 0 and episode % render_interval == 0:
                os.system("clear" if os.name == "posix" else "cls")
                print(f"Episode: {episode + 1}/{episodes}")
                print(f"Step: {game_steps}, Player: {env.current_player}")
                print(f"Primary agent is Player {primary_agent_player}")
                print(f"Current turn: {'Primary' if is_primary_turn else 'Opponent'}")
                env.render()
                time.sleep(0.5)

        # Record game result based on primary agent's player number
        primary_agent_won = env.winner == primary_agent_player
        opponent_agent_won = env.winner is not None and env.winner != primary_agent_player

        if primary_agent_won:
            primary_wins.append(1)
            opponent_wins.append(0)
            draws.append(0)
        elif opponent_agent_won:
            primary_wins.append(0)
            opponent_wins.append(1)
            draws.append(0)
        else:  # Draw
            primary_wins.append(0)
            opponent_wins.append(0)
            draws.append(1)

        # Update ELO rating
        if env.winner is not None:
            elo_ratings.append(
                _update_elo(
                    elo_ratings[-1],
                    primary_agent_won,
                    k_factor=32,
                )
            )
        else:
            elo_ratings.append(elo_ratings[-1])  # No change for draws

        # Record metrics for this episode
        rewards.append(total_reward)
        q_table_sizes.append(primary_agent.get_q_table_size())
        exploration_rates.append(primary_agent.exploration_rate)

        # Decay exploration rate
        primary_agent.decay_exploration()

        # Update opponent agent periodically
        if (episode + 1) % opponent_update_interval == 0:
            opponent_agent = copy.deepcopy(primary_agent)
            print(f"\nUpdated opponent agent at episode {episode + 1}")

        # Save periodically
        if (episode + 1) % save_interval == 0 or episode == episodes - 1:
            # Calculate stats
            recent_rewards = np.mean(rewards[-100:])
            recent_win_rate = np.mean(primary_wins[-100:])
            recent_loss_rate = np.mean(opponent_wins[-100:])
            recent_draw_rate = np.mean(draws[-100:])

            # Save models
            primary_agent.save_qtable_pickle(f"dropmind/models/qtable_episode_{episode + 1}.pkl")
            if save_json:
                primary_agent.save_qtable_json(f"dropmind/models/qtable_episode_{episode + 1}.json")

            # Log progress
            elapsed_time = time.time() - start_time
            print(f"\nEpisode {episode + 1} completed in {elapsed_time:.2f} seconds")
            print(f"Q-table size: {primary_agent.get_q_table_size()} states")
            print(f"Recent primary win rate: {recent_win_rate:.2f}")
            print(f"Recent opponent win rate: {recent_loss_rate:.2f}")
            print(f"Recent draw rate: {recent_draw_rate:.2f}")
            print(f"Recent average reward: {recent_rewards:.2f}")
            print(f"Current exploration rate: {primary_agent.exploration_rate:.4f}")
            print(f"Current ELO rating: {elo_ratings[-1]:.1f}")

            # Plot metrics
            plot_self_play_metrics(
                episode, rewards, primary_wins, opponent_wins, draws, q_table_sizes, exploration_rates, elo_ratings
            )

    # Final save
    primary_agent.save_qtable_pickle("dropmind/models/qtable_final.pkl")
    if save_json:
        primary_agent.save_qtable_json("dropmind/models/qtable_final.json")

    return primary_agent, rewards, primary_wins, opponent_wins, draws, elo_ratings


def _convert_state_for_opponent(state):
    """
    Convert a state representation to the opponent's perspective.

    In Connect Three, we need to swap the player numbers (1 and 2)
    to allow the agent to learn from both perspectives.

    Since the primary agent is now player 2, this function is used
    to convert states for the opponent (player 1).
    """
    # Convert string to list for easy manipulation
    state_list = list(state)

    # Swap 1s and 2s: replace 1 with 'x', 2 with 1, then 'x' with 2
    for i in range(len(state_list)):
        if state_list[i] == "1":
            state_list[i] = "x"  # Temporary placeholder
        elif state_list[i] == "2":
            state_list[i] = "1"

    for i in range(len(state_list)):
        if state_list[i] == "x":
            state_list[i] = "2"

    # Convert back to string
    return "".join(state_list)


def _update_elo(current_elo, won, k_factor=32):
    """
    Update ELO rating based on game outcome.

    Args:
        current_elo: Current ELO rating
        won: Whether the primary agent won
        k_factor: K-factor for ELO calculation (determines rating volatility)

    Returns:
        Updated ELO rating
    """
    # Since we're playing against a snapshot of ourself,
    # we can use a fixed opponent rating of 1000
    opponent_elo = 1000

    # Calculate expected score
    expected = 1 / (1 + 10 ** ((opponent_elo - current_elo) / 400))

    # Calculate actual score
    actual = 1.0 if won else 0.0

    # Update ELO
    new_elo = current_elo + k_factor * (actual - expected)

    return new_elo


def plot_self_play_metrics(
    episode, rewards, primary_wins, opponent_wins, draws, q_table_sizes, exploration_rates, elo_ratings
):
    """Plot training metrics for self-play."""
    plt.figure(figsize=(15, 12))

    # Calculate window size for moving averages
    window_size = min(100, len(rewards))

    # Plot rewards
    plt.subplot(3, 2, 1)
    plt.plot(rewards)
    plt.plot(np.convolve(rewards, np.ones(window_size) / window_size, mode="valid"))
    plt.title("Rewards per Episode")
    plt.xlabel("Episode")
    plt.ylabel("Total Reward")

    # Plot win rates
    plt.subplot(3, 2, 2)
    primary_win_rate = np.convolve(primary_wins, np.ones(window_size) / window_size, mode="valid")
    opponent_win_rate = np.convolve(opponent_wins, np.ones(window_size) / window_size, mode="valid")
    draw_rate = np.convolve(draws, np.ones(window_size) / window_size, mode="valid")

    plt.plot(primary_win_rate, label="Primary Agent")
    plt.plot(opponent_win_rate, label="Opponent Agent")
    plt.plot(draw_rate, label="Draws")
    plt.title("Outcome Rates (Moving Average)")
    plt.xlabel("Episode")
    plt.ylabel("Rate")
    plt.ylim(0, 1)
    plt.legend()

    # Plot game outcomes
    plt.subplot(3, 2, 3)
    outcomes = np.array([primary_wins, opponent_wins, draws]).T
    if len(outcomes) > 0:
        cumulative_outcomes = np.cumsum(outcomes, axis=0)
        plt.stackplot(
            range(len(cumulative_outcomes)),
            [cumulative_outcomes[:, 0], cumulative_outcomes[:, 1], cumulative_outcomes[:, 2]],
            labels=["Primary Wins", "Opponent Wins", "Draws"],
            colors=["green", "red", "blue"],
        )
        plt.legend(loc="upper left")
        plt.title("Cumulative Game Outcomes")
        plt.xlabel("Episode")
        plt.ylabel("Count")

    # Plot Q-table size
    plt.subplot(3, 2, 4)
    plt.plot(q_table_sizes)
    plt.title("Q-table Size Growth")
    plt.xlabel("Episode")
    plt.ylabel("Number of States")

    # Plot exploration rate
    plt.subplot(3, 2, 5)
    plt.plot(exploration_rates)
    plt.title("Exploration Rate Decay")
    plt.xlabel("Episode")
    plt.ylabel("Epsilon")
    plt.ylim(0, 1)

    # Plot ELO rating
    plt.subplot(3, 2, 6)
    plt.plot(elo_ratings)
    plt.title("ELO Rating Progression")
    plt.xlabel("Episode")
    plt.ylabel("ELO Rating")

    plt.tight_layout()
    plt.savefig(f"dropmind/graphs/self_play_progress_episode_{episode + 1}.png")
    plt.close()


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Train a Q-learning agent using self-play for Connect Three")
    parser.add_argument("--episodes", type=int, default=10000, help="Number of episodes to train")
    parser.add_argument("--save-interval", type=int, default=1000, help="Save model every X episodes")
    parser.add_argument("--learning-rate", type=float, default=0.1, help="Learning rate (alpha)")
    parser.add_argument("--discount-factor", type=float, default=0.9, help="Discount factor (gamma)")
    parser.add_argument("--exploration-rate", type=float, default=1.0, help="Initial exploration rate (epsilon)")
    parser.add_argument("--exploration-decay", type=float, default=0.995, help="Exploration decay rate")
    parser.add_argument("--min-exploration-rate", type=float, default=0.01, help="Minimum exploration rate")
    parser.add_argument("--opponent-update", type=int, default=500, help="Update opponent every X episodes")
    parser.add_argument("--no-json", action="store_false", dest="save_json", help="Do not save in JSON format")
    parser.add_argument("--render", type=int, default=0, help="Render every X episodes (0 for no rendering)")
    args = parser.parse_args()

    # Train the agent
    self_play_train(
        episodes=args.episodes,
        save_interval=args.save_interval,
        learning_rate=args.learning_rate,
        discount_factor=args.discount_factor,
        exploration_rate=args.exploration_rate,
        exploration_decay=args.exploration_decay,
        min_exploration_rate=args.min_exploration_rate,
        opponent_update_interval=args.opponent_update,
        save_json=args.save_json,
        render_interval=args.render,
    )
