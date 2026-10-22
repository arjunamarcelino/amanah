// Shared router-animation phase/state unions, so the animation (RouterAnimation/RailCard)
// and the driver (RoutePayoutCard) can't drift apart structurally.
export type RouterPhase = "idle" | "thinking" | "decided" | "fallback";
export type RailCardState = "idle" | "thinking" | "chosen" | "dimmed" | "fallbackChosen";
