package com.example.mockbanking;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;

@CucumberOptions(
    features = "src/test/resources/features",
    glue = "com.example.mockbanking",
    plugin = {
        "pretty",
        "json:target/cucumber.json"
    }
)
public class RunCucumberTest extends AbstractTestNGCucumberTests {
}
