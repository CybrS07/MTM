export const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-US");
export const clock = (start: string, offset: number) => {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + offset;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
