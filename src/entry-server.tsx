// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { startMAMonitor } from "./monitor/ma-convergence";

// 确保在服务器环境下只启动一次监控
type GlobalWithMonitor = typeof globalThis & {
	__MA_MONITOR_STARTED__?: boolean;
};

const globalWithMonitor = globalThis as GlobalWithMonitor;
if (
	typeof window === "undefined" &&
	!globalWithMonitor.__MA_MONITOR_STARTED__
) {
	globalWithMonitor.__MA_MONITOR_STARTED__ = true;
	startMAMonitor().catch(console.error);
}

export default createHandler(() => {
	return (
		<StartServer
			document={({ assets, children, scripts }) => (
				<html lang="en">
					<head>
						<meta charset="utf-8" />
						<meta
							name="viewport"
							content="width=device-width, initial-scale=1"
						/>
						<link rel="icon" href="/favicon.ico" />
						<link rel="preconnect" href="https://fonts.googleapis.com" />
						<link
							rel="preconnect"
							href="https://fonts.gstatic.com"
							crossOrigin="anonymous"
						/>
						<link
							href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
							rel="stylesheet"
						/>
						{assets}
					</head>
					<body>
						<div id="app">{children}</div>
						{scripts}
					</body>
				</html>
			)}
		/>
	);
});
