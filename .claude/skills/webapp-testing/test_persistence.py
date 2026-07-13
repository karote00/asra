#!/usr/bin/env python3
"""Test persistence functionality - elements should persist after page reload"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate to the app
    page.goto('http://localhost:3001')
    page.wait_for_load_state('networkidle')
    
    # Enable console log capture
    console_messages = []
    def log_console(msg):
        console_messages.append(msg.text)
        print(f"[Console] {msg.text}")
    page.on('console', log_console)
    
    # --- Test 1: Create an element ---
    print("\n=== Test 1: Creating initial element ===")
    
    # Find and click a create button or check if there are elements already
    # Let's first inspect what's on the page
    screenshot_path = '/tmp/persistence-test-1-initial.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")
    
    # Check page content
    content = page.content()
    
    # Look for any element creation UI. Since we don't know the exact UI,
    # let's check what buttons exist
    buttons = page.locator('button').all()
    print(f"Found {len(buttons)} buttons on page:")
    for i, btn in enumerate(buttons):
        text = btn.content_text()
        print(f"  Button {i}: {text}")
    
    # Check if there's a canvas or PIXI container
    canvas = page.locator('canvas')
    if canvas.count() > 0:
        print(f"Found {canvas.count()} canvas element(s)")
    
    # Try to interact with the canvas - click in the center
    # This might create or select an element
    page.mouse.move(400, 300)
    page.mouse.up()
    page.wait_for_timeout(500)
    
    # Take another screenshot
    screenshot_path = '/tmp/persistence-test-2-after-click.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")
    
    # --- Test 2: Reload page and check for persistence ---
    print("\n=== Test 2: Reloading page to test persistence ===")
    page.reload()
    page.wait_for_load_state('networkidle')
    
    # Wait a bit for any async operations
    page.wait_for_timeout(500)
    
    # Take screenshot after reload
    screenshot_path = '/tmp/persistence-test-3-after-reload.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")
    
    # --- Test 3: Try creating a new element ---
    print("\n=== Test 3: Creating new element after reload ===")
    page.mouse.move(500, 400)
    page.mouse.up()
    page.wait_for_timeout(500)
    
    # Take final screenshot
    screenshot_path = '/tmp/persistence-test-4-final.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")
    
    # Summary
    print("\n=== Test Summary ===")
    print("Screenshots:")
    print("  1. Initial state: /tmp/persistence-test-1-initial.png")
    print("  2. After click: /tmp/persistence-test-2-after-click.png")
    print("  3. After reload: /tmp/persistence-test-3-after-reload.png")
    print("  4. Final state: /tmp/persistence-test-4-final.png")
    print(f"\nConsole messages captured: {len(console_messages)}")
    
    browser.close()
