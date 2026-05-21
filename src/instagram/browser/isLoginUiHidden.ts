export function isLoginUiHidden(): boolean {
  class LoginUiDetector {
    public isHidden(): boolean {
      return !this.hasLoginInput() && !this.isLoginPage();
    }

    private hasLoginInput(): boolean {
      return Boolean(document.querySelector('input[name="username"], input[name="password"]'));
    }

    private isLoginPage(): boolean {
      return location.pathname.startsWith('/accounts/login');
    }
  }

  return new LoginUiDetector().isHidden();
}
