import sys
import traceback

# Import the tests
from api.tests.test_contextual_engine import (
    test_independent_url_block,
    test_heuristic_url_not_independent_block,
    test_semantic_only_not_block,
    test_contradiction_logic_with_missing_vision
)

def run_test(name, test_func):
    print(f"Running {name}...")
    try:
        test_func()
        print(f"✅ {name} passed!\n")
        return True
    except AssertionError as e:
        print(f"❌ {name} failed: AssertionError")
        traceback.print_exc()
        print("\n")
        return False
    except Exception as e:
        print(f"❌ {name} failed with error: {e}")
        traceback.print_exc()
        print("\n")
        return False

if __name__ == "__main__":
    tests = [
        ("test_independent_url_block", test_independent_url_block),
        ("test_heuristic_url_not_independent_block", test_heuristic_url_not_independent_block),
        ("test_semantic_only_not_block", test_semantic_only_not_block),
        ("test_contradiction_logic_with_missing_vision", test_contradiction_logic_with_missing_vision)
    ]
    
    print("=== STARTING CONTEXTUAL ENGINE TESTS ===\n")
    passed = 0
    for name, func in tests:
        if run_test(name, func):
            passed += 1
            
    print("=== TEST SUMMARY ===")
    print(f"Passed: {passed}/{len(tests)}")
    if passed == len(tests):
        print("🎉 ALL TESTS PASSED! READY FOR BENCHMARKING.")
        sys.exit(0)
    else:
        print("⚠️ SOME TESTS FAILED.")
        sys.exit(1)
