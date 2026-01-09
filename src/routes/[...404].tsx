import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";

export default function NotFound() {
	return (
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
			<Title>Not Found</Title>
			<HttpStatusCode code={404} />
			<div class="text-center">
				<h1 class="text-6xl font-black text-white mb-4">404</h1>
				<p class="text-2xl font-bold text-slate-400 mb-8">Page Not Found</p>
				<p class="text-slate-500 mb-8">
					The page you are looking for does not exist. Please check the URL or
					return to the dashboard.
				</p>
				<a
					href="/"
					class="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
				>
					← Return to Dashboard
				</a>
			</div>
		</div>
	);
}
