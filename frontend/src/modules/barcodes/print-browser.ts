export function waitThenPrint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const finish = () => {
          window.removeEventListener("afterprint", finish);
          resolve();
        };
        window.addEventListener("afterprint", finish);
        window.print();
        window.setTimeout(finish, 1200);
      });
    });
  });
}
