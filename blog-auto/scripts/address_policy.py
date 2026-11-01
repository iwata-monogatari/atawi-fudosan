"""Shared address gate. Fail closed before updating publication state."""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def check_address_policy(*paths):
    try:
        result = subprocess.run(
            ["node", os.path.join(ROOT, "_tools", "check-property-address-policy.mjs"), *paths],
            cwd=ROOT, check=False)
        return result.returncode == 0
    except OSError as error:
        print("Address policy check could not run: %s" % error)
        return False
