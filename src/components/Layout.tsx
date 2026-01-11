import { type Component, children, type JSX } from "solid-js";
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
		</div>
	);
};

export default Layout;
