import { children, type Component, type JSX } from "solid-js";
import GlobalNav from "./GlobalNav";

interface LayoutProps {
	children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
	const resolvedChildren = children(() => props.children);

	return (
		<div class="min-h-screen flex flex-col bg-[#0b0e14]">
			{/* Navigation Bar */}
			<GlobalNav />

			{/* 
                Main Content Area 
                - 'isolate': Creates a new stacking context, preventing z-index leaks.
                - 'w-full': Ensures strict width constraint.
                - 'border-t border-transparent': A CSS hack to prevent Margin Collapse 
                  (where child margins push the parent down), fixing the "page moves down" issue.
            */}
			<main class="grow w-full isolate border-t border-transparent">
				{resolvedChildren()}
			</main>

			{/* Footer */}
			<footer class="border-t border-white/5 bg-[#0b0e14]/50 mt-auto">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div class="flex flex-col md:flex-row justify-between items-center gap-6">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white text-sm font-bold shadow-lg">
								D
							</div>
							<span class="text-slate-400 text-xs font-bold tracking-widest uppercase">
								Directive Control Center
							</span>
						</div>

						<p class="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center md:text-right max-w-sm leading-relaxed">
							Unclassified Framework. Distribution restricted to authorized
							entities.
						</p>
					</div>
					<div class="mt-6 pt-6 border-t border-white/5 text-center text-[9px] font-bold text-slate-700 tracking-[0.2em] uppercase">
						Executed at {new Date().getFullYear()} / System Stable
					</div>
				</div>
			</footer>
		</div>
	);
};

export default Layout;
