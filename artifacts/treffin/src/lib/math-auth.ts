const MATH_USER_ID_KEY = "math_user_id";
const MATH_USERNAME_KEY = "math_username";

export function getMathUserId(): string | null {
  return localStorage.getItem(MATH_USER_ID_KEY);
}

export function getMathUsername(): string | null {
  return localStorage.getItem(MATH_USERNAME_KEY);
}

export function syncMathUser(clerkUserId: string, displayName: string): void {
  localStorage.setItem(MATH_USER_ID_KEY, clerkUserId);
  localStorage.setItem(MATH_USERNAME_KEY, displayName);
}

export function clearMathUser(): void {
  localStorage.removeItem(MATH_USER_ID_KEY);
  localStorage.removeItem(MATH_USERNAME_KEY);
}
