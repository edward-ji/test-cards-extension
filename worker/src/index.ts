/**
 * Test Cards Extension Redirect Worker
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Env { }

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const userAgent = request.headers.get('User-Agent') || '';

		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
		const isChromeDesktop = /Chrome/i.test(userAgent) && !/Edge|Edg|OPR|Opera/i.test(userAgent) && !isMobile;
		const isFirefoxDesktop = /Firefox/i.test(userAgent) && !isMobile;

		const chromeUrl = 'https://chromewebstore.google.com/detail/ddflppoejkafcaedakefoakkmaholoeh';
		const firefoxUrl = 'https://addons.mozilla.org/en-US/firefox/addon/test-cards/';
		const githubIssueUrl = 'https://github.com/edward-ji/test-cards-extension/issues/1';

		if (isChromeDesktop) {
			return Response.redirect(chromeUrl, 302);
		} else if (isFirefoxDesktop) {
			return Response.redirect(firefoxUrl, 302);
		} else {
			return Response.redirect(githubIssueUrl, 302);
		}
	},
};
